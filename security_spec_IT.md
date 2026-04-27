# Specifiche di Sicurezza: Memorie Marziesi

## 1. Invarianti dei Dati
- **Identità Utente:** Un profilo utente (`users/{userId}`) può essere modificato solo dal suo proprietario. I campi `role` e `points` sono rigorosamente immutabili da parte degli utenti standard; possono essere modificati solo da un Admin o Root.
- **La Coda "Pending" e Gerarchia Ruoli:** 
  - Gli utenti standard si registrano forzatamente come `accountStatus: 'pending'` e `role: 'Guest'`. 
  - Root si registra organicamente aggirando questo con (`accountStatus: 'approved'`).
  - Gli Admin possono modificare in `/users` lo stato `accountStatus` e portarlo ad `approved` abbinando `role: 'Guest'`.
  - Admin possono elevare da Guest approvato a `Admin`.
  - Solo Root forza un downgrade o promuove un pending direttamente ad `Admin` o manipola altri Admin.
- **Proprietà del Post:** Una memoria (`posts/{postId}`) non può esistere senza un `authorId` valido che coincida con l'utente creatore del doc. `authorId` è immutabile.
- **Integrità Relazionale Commenti:** Un commento (`posts/{postId}/comments/{commentId}`) appartiene al Post madre. Se il Post è oscurato o privato, previene i fetch su autorizzazioni commentare.
- **Updates Mappati:** Azioni specifiche. Un utente agisce solo ed esclusivamente e singolarmente su `caption`, `visibilityStatus`, `visibilityTime`, `showInCinematografo`, o `location`. L'aggiornamento dei "Mi Piace" (cuori) incorpora una doppia validazione con tracking tramite array (`likedBy`) legando matematicamente l'update all'accoppiata di logiche su `likesCount`, prevenendo loop, falsificazioni dei conteggi ed upvotes infiniti per singolo post.
- **Isolamento PII:** `users` possiede `email`. Non consultabile in array o collection read ad utenze normali.

## 2. Le "Dodici Sporche" Intercettazioni (Dirty Dozen)
1. **The Shadow Update:** Tentare di inserire campi fasulli non validati per farli leggere.
2. **The ID Poisoner:** ID stringa di GigaByte di dimensioni. Tagliato alla base.
3. **The Privilege Escalator (RBAC Bypass):** L'utente tenta mutazioni interne ad App ad "Admin", stoppato duramente.
4. **The Admin Demotion (Admin Bypass):** Tentativo tra pari per destituire Admin, negato.
5. **The Value Poisoner:** String payload mandato in attesa di Type specific. Bloccato.
6. **The Email Spoofing Test:** Bypass con finta email non garantita (email_verified flag fail).
7. **The PII Blanket Test:** Query scraping delle info app per leggere array, annullato.
8. **The Timewarp:** Creazione di commento al 2088 bloccato.
9. **The Denial of Wallet (Arrays):** Nessuna entità contiene liste eccessive in array statico. Listate in collection.
10. **The Outcome Override:** Alterazioni eventi conclusi respinte.
11. **The Unauthorized Relational Grab:** Prelevamento commenti in query private respingerà accesso di colpo.
12. **The Orphanizer:** Previene distruzioni massive ma orfane del creatore principale mantenendo il check su autore.

## 3. Test Runner
Accertare schema esatto per la corretta gestione testata ed isolata che riprenderà sempre i punti soprastanti rendendo Firestore uno scudo effettivo e non solo virtuale limitato a logica per UI.
