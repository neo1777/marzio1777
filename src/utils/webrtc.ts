import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot, Unsubscribe, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';

const STUN_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const CHUNK_SIZE = 16384; // 16KB

export class WebRTCTransfer {
  private peerConnection: RTCPeerConnection | null = null;
  public dataChannel: RTCDataChannel | null = null;
  private unsubscribeSignaling: Unsubscribe | null = null;
  
  private onTrackReceived?: (blob: Blob) => void;
  private onProgress?: (percent: number) => void;
  private onError?: (err: string) => void;
  public onConnected?: () => void;
  
  private receiveBuffer: ArrayBuffer[] = [];
  private expectedChunks = 0;
  private receivedChunks = 0;
  private receiveMime = '';
  
  private role: 'dj' | 'proposer';
  private sessionId: string;
  private proposerId: string;
  private queueItemId: string;
  
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(
    role: 'dj' | 'proposer',
    sessionId: string,
    proposerId: string,
    queueItemId: string,
    cb?: {
      onTrackReceived?: (blob: Blob) => void;
      onProgress?: (percent: number) => void;
      onError?: (err: string) => void;
      onConnected?: () => void;
    }
  ) {
    this.role = role;
    this.sessionId = sessionId;
    this.proposerId = proposerId;
    this.queueItemId = queueItemId;
    if (cb) {
       this.onTrackReceived = cb.onTrackReceived;
       this.onProgress = cb.onProgress;
       this.onError = cb.onError;
       this.onConnected = cb.onConnected;
    }
  }
  
  private resetTimeout() {
     if (this.timeoutId) clearTimeout(this.timeoutId);
     this.timeoutId = setTimeout(() => {
        if (this.peerConnection?.connectionState !== 'connected' && this.dataChannel?.readyState !== 'open') {
           this.handleError('Timeout connessione WebRTC');
        } else if (this.role === 'dj' && this.receivedChunks < this.expectedChunks) {
           this.handleError('Timeout ricezione dati');
        }
     }, 15000); // 15 seconds
  }

  public async initiateAsDJ() {
    this.peerConnection = new RTCPeerConnection(STUN_SERVERS);
    this.resetTimeout();
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
         updateDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), {
            djCandidates: arrayUnion({
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              addedAt: Timestamp.now()
            }) 
         }).catch(() => {
            // fallback if doc not exists
            setDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), { djCandidates: [{
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              addedAt: Timestamp.now()
            }] }, { merge: true });
         });
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
       if (this.peerConnection?.connectionState === 'connected') {
          if (this.onConnected) this.onConnected();
       } else if (this.peerConnection?.connectionState === 'failed' || this.peerConnection?.connectionState === 'disconnected') {
          this.handleError('Connessione interrotta');
       }
    };
    
    this.dataChannel = this.peerConnection.createDataChannel('audio', { ordered: true });
    this.setupDataChannel(this.dataChannel);

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    
    await setDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), {
      sessionId: this.sessionId,
      djOffer: {
        sdp: offer.sdp,
        type: offer.type,
        queueItemId: this.queueItemId,
        createdAt: Timestamp.now(),
      },
      expireAt: Timestamp.fromMillis(Date.now() + 60_000),
    }, { merge: true });
    
    this.subscribeToSignaling();
  }
  
  public async answerAsProposer(offerDetails: any) {
    this.peerConnection = new RTCPeerConnection(STUN_SERVERS);
    this.resetTimeout();
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
         updateDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), {
            proposerCandidates: arrayUnion({
               candidate: event.candidate.candidate,
               sdpMid: event.candidate.sdpMid,
               sdpMLineIndex: event.candidate.sdpMLineIndex,
               addedAt: Timestamp.now()
            })
         }).catch(() => {
            setDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), { proposerCandidates: [{
               candidate: event.candidate.candidate,
               sdpMid: event.candidate.sdpMid,
               sdpMLineIndex: event.candidate.sdpMLineIndex,
               addedAt: Timestamp.now()
            }] }, { merge: true });
         });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection?.connectionState === 'connected') {
         if (this.onConnected) this.onConnected();
      } else if (this.peerConnection?.connectionState === 'failed' || this.peerConnection?.connectionState === 'disconnected') {
         this.handleError('Connessione interrotta');
      }
   };
    
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
       type: offerDetails.type,
       sdp: offerDetails.sdp
    }));
    
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    await setDoc(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), {
      sessionId: this.sessionId,
      proposerAnswer: {
        sdp: answer.sdp,
        type: answer.type,
        createdAt: Timestamp.now(),
      },
    }, { merge: true });
    
    this.subscribeToSignaling();
  }
  
  private subscribeToSignaling() {
    this.unsubscribeSignaling = onSnapshot(doc(db, 'audio_sessions', this.sessionId, 'signaling', this.proposerId), async (snapshot) => {
       const data = snapshot.data();
       if (!data) return;
       
       if (this.role === 'dj' && data.proposerAnswer && this.peerConnection?.signalingState !== 'stable') {
          try {
            await this.peerConnection?.setRemoteDescription(new RTCSessionDescription({
               type: data.proposerAnswer.type,
               sdp: data.proposerAnswer.sdp
            }));
          } catch(e) {}
       }
       
       if (this.role === 'dj' && data.proposerCandidates) {
          for (const cand of data.proposerCandidates) {
             try {
                await this.peerConnection?.addIceCandidate(new RTCIceCandidate(cand));
             } catch(e) {}
          }
       }
       
       if (this.role === 'proposer' && data.djCandidates) {
          for (const cand of data.djCandidates) {
             try {
                await this.peerConnection?.addIceCandidate(new RTCIceCandidate(cand));
             } catch(e) {}
          }
       }
    });
  }
  
  private setupDataChannel(dc: RTCDataChannel) {
     dc.binaryType = 'arraybuffer';
     
     dc.onopen = () => {
        // Ready for transmission
        if (this.onConnected) this.onConnected(); // double firing is fine
     };
     
     dc.onmessage = (event) => {
        if (typeof event.data === 'string') {
           try {
              const msg = JSON.parse(event.data);
              if (msg.type === 'meta') {
                 this.expectedChunks = msg.totalChunks;
                 this.receiveMime = msg.mimeType;
                 this.receiveBuffer = [];
                 this.receivedChunks = 0;
                 this.resetTimeout();
              }
           } catch(e) {}
        } else if (event.data instanceof ArrayBuffer) {
           this.receiveBuffer.push(event.data);
           this.receivedChunks++;
           this.resetTimeout();
           
           if (this.onProgress && this.expectedChunks > 0) {
              this.onProgress(Math.floor((this.receivedChunks / this.expectedChunks) * 100));
           }
           
           if (this.receivedChunks === this.expectedChunks) {
              this.assembleBlob();
           }
        }
     };
     
     dc.onerror = () => this.handleError('Data channel error');
     dc.onclose = () => {
        if (this.role === 'dj' && this.receivedChunks < this.expectedChunks && this.expectedChunks > 0) {
           this.handleError('Connessione persa prima della fine del file');
        }
     };
  }
  
  private assembleBlob() {
     try {
        const blob = new Blob(this.receiveBuffer, {type: this.receiveMime});
        if (this.onTrackReceived) this.onTrackReceived(blob);
     } catch (e) {
        this.handleError('Errore ricostruzione file');
     }
  }
  
  public async sendBlobBinary(blob: Blob) {
      if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
         this.handleError('Data channel non pronto');
         return;
      }
      
      const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
      this.dataChannel.send(JSON.stringify({
         type: 'meta',
         totalChunks,
         mimeType: blob.type
      }));
      
      const reader = new FileReader();
      let offset = 0;
      let chunkIndex = 0;
      
      const sendNextChunk = () => {
         if (offset >= blob.size) {
            // we are done
            return;
         }
         
         if (this.dataChannel!.bufferedAmount > CHUNK_SIZE * 64) {
            // Wait for buffer to drain
            setTimeout(sendNextChunk, 50);
            return;
         }
         
         const slice = blob.slice(offset, offset + CHUNK_SIZE);
         reader.readAsArrayBuffer(slice);
      };
      
      reader.onload = (e) => {
         if (e.target?.result && this.dataChannel?.readyState === 'open') {
             this.dataChannel.send(e.target.result as ArrayBuffer);
             offset += CHUNK_SIZE;
             chunkIndex++;
             
             if (this.onProgress) {
                this.onProgress(Math.floor((chunkIndex / totalChunks) * 100));
             }
             sendNextChunk();
         }
      };
      reader.onerror = () => this.handleError('Reader offline');
      
      sendNextChunk();
  }

  private handleError(err: string) {
     if (this.onError) this.onError(err);
     this.destroy(); 
  }
  
  public destroy() {
     if (this.timeoutId) clearTimeout(this.timeoutId);
     if (this.unsubscribeSignaling) this.unsubscribeSignaling();
     if (this.dataChannel) {
        this.dataChannel.close();
        this.dataChannel = null;
     }
     if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
     }
  }
}
