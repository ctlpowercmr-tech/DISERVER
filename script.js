class DistributeurCTL {
    constructor() {
        this.panier = [];
        this.transactionEnCours = null;
        this.timerExpiration = null;
        this.API_URL = CONFIG.API_URL;
        this.estConnecte = false;
        
        this.init();
    }
    
    async init() {
        await this.testerConnexionServeur();
        this.afficherBoissons();
        this.chargerSolde();
        this.setupEventListeners();
        
        setInterval(() => this.verifierStatutTransaction(), 2000);
        setInterval(() => this.testerConnexionServeur(), 30000);
    }
    
    async testerConnexionServeur() {
        try {
            const debut = Date.now();
            const response = await fetch(`${this.API_URL}/api/health`);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const result = await response.json();
            const tempsReponse = Date.now() - debut;
            
            if (result.status === 'OK') {
                this.estConnecte = true;
                this.mettreAJourStatutConnexion('connecte');
                return true;
            } else {
                throw new Error('Réponse serveur invalide');
            }
        } catch (error) {
            console.error('❌ Erreur connexion serveur:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            return false;
        }
    }
    
    mettreAJourStatutConnexion(statut, message = '') {
        let statutElement = document.getElementById('statut-connexion');
        
        if (!statutElement) {
            statutElement = document.createElement('div');
            statutElement.id = 'statut-connexion';
            document.body.appendChild(statutElement);
        }
        
        if (statut === 'connecte') {
            statutElement.textContent = '🟢 CTL-Power Connecté';
            statutElement.style.background = 'rgba(76, 175, 80, 0.9)';
            statutElement.style.color = 'white';
        } else {
            statutElement.textContent = '🔴 CTL-Power Hors Ligne';
            statutElement.style.background = 'rgba(244, 67, 54, 0.9)';
            statutElement.style.color = 'white';
        }
    }
    
    afficherBoissons() {
        const grid = document.getElementById('boissons-grid');
        grid.innerHTML = '';
        
        BOISSONS.forEach(boisson => {
            const card = document.createElement('div');
            card.className = 'boisson-card';
            card.innerHTML = `
                <div class="boisson-image">
                    <img src="${boisson.image}" alt="${boisson.nom}" 
                         onerror="this.src='https://via.placeholder.com/180x180/667eea/ffffff?text=${boisson.nom}'">
                </div>
                <div class="boisson-nom">${boisson.nom}</div>
                <div class="boisson-prix">${boisson.prix.toLocaleString()} FCFA</div>
            `;
            
            card.addEventListener('click', () => this.ajouterAuPanier(boisson));
            grid.appendChild(card);
        });
    }
    
    ajouterAuPanier(boisson) {
        if (this.panier.length >= 2) {
            this.afficherNotification('⚠️ Maximum 2 boissons autorisées', 'warning');
            return;
        }
        
        if (this.panier.find(item => item.id === boisson.id)) {
            this.afficherNotification('⚠️ Cette boisson est déjà sélectionnée', 'warning');
            return;
        }
        
        this.panier.push(boisson);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.afficherNotification(`✅ ${boisson.nom} ajoutée`, 'success');
    }
    
    afficherNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 25px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            backdrop-filter: blur(20px);
            animation: slideDown 0.3s ease;
        `;
        
        if (type === 'success') {
            notification.style.background = 'rgba(76, 175, 80, 0.9)';
        } else if (type === 'warning') {
            notification.style.background = 'rgba(255, 152, 0, 0.9)';
        } else {
            notification.style.background = 'rgba(33, 150, 243, 0.9)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    retirerDuPanier(boissonId) {
        const boisson = this.panier.find(item => item.id === boissonId);
        this.panier = this.panier.filter(item => item.id !== boissonId);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        
        if (boisson) {
            this.afficherNotification(`❌ ${boisson.nom} retirée`, 'warning');
        }
    }
    
    mettreAJourPanier() {
        const panierElement = document.getElementById('panier');
        const totalElement = document.getElementById('total-panier');
        const counterElement = document.getElementById('counter');
        
        counterElement.textContent = `${this.panier.length}/2`;
        
        if (this.panier.length === 0) {
            panierElement.innerHTML = '<div class="vide">Aucune boisson sélectionnée</div>';
        } else {
            panierElement.innerHTML = '';
            this.panier.forEach(boisson => {
                const item = document.createElement('div');
                item.className = 'item-panier';
                item.innerHTML = `
                    <div>
                        <strong>${boisson.nom}</strong>
                        <div style="font-size: 0.9rem; opacity: 0.8;">${boisson.prix.toLocaleString()} FCFA</div>
                    </div>
                    <button onclick="distributeur.retirerDuPanier(${boisson.id})" class="btn-retirer">✕</button>
                `;
                panierElement.appendChild(item);
            });
        }
        
        const total = this.panier.reduce((sum, boisson) => sum + boisson.prix, 0);
        totalElement.textContent = total.toLocaleString();
    }
    
    mettreAJourBoutons() {
        const btnPayer = document.getElementById('btn-payer');
        const btnModifier = document.getElementById('btn-modifier');
        
        btnPayer.disabled = this.panier.length === 0 || !this.estConnecte;
        btnModifier.disabled = this.panier.length === 0;
    }
    
    setupEventListeners() {
        document.getElementById('btn-payer').addEventListener('click', () => this.demarrerPaiement());
        document.getElementById('btn-modifier').addEventListener('click', () => this.modifierCommande());
        document.getElementById('annuler-paiement').addEventListener('click', () => this.annulerPaiement());
    }
    
    async demarrerPaiement() {
        if (!this.estConnecte) {
            this.afficherNotification('❌ Impossible de se connecter au serveur CTL-Power', 'error');
            await this.testerConnexionServeur();
            return;
        }
        
        const total = this.panier.reduce((sum, boisson) => sum + boisson.prix, 0);
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    montant: total,
                    boissons: this.panier
                })
            });
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.transactionEnCours = result.data;
                this.afficherQRCode(result.data);
                this.demarrerTimerExpiration();
                this.afficherNotification('✅ QR Code généré - Scannez avec CTL-Pay', 'success');
            } else {
                throw new Error(result.error || 'Erreur lors de la création de la transaction');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion('erreur', error.message);
            this.afficherNotification('❌ Erreur de connexion au serveur', 'error');
        }
    }
    
    afficherQRCode(transaction) {
        const paiementSection = document.getElementById('paiement-section');
        const qrCodeElement = document.getElementById('qr-code');
        const transactionIdElement = document.getElementById('transaction-id');
        const montantTransactionElement = document.getElementById('montant-transaction');
        
        paiementSection.style.display = 'block';
        
        transactionIdElement.textContent = transaction.id;
        montantTransactionElement.textContent = transaction.montant.toLocaleString();
        
        const qrData = JSON.stringify({
            transactionId: transaction.id,
            montant: transaction.montant,
            apiUrl: this.API_URL,
            timestamp: Date.now()
        });
        
        qrCodeElement.innerHTML = '';
        
        try {
            const typeNumber = 0;
            const errorCorrectionLevel = 'L';
            const qr = qrcode(typeNumber, errorCorrectionLevel);
            qr.addData(qrData);
            qr.make();
            
            qrCodeElement.innerHTML = qr.createImgTag(4);
        } catch (error) {
            console.error('Erreur génération QR code:', error);
            qrCodeElement.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 15px; text-align: center; color: black;">
                    <h3 style="margin-bottom: 15px; color: #333;">ID Transaction CTL:</h3>
                    <p style="font-size: 28px; font-weight: bold; margin: 20px 0; color: #667eea;">${transaction.id}</p>
                    <p style="font-size: 18px; margin: 10px 0;">Montant: <strong>${transaction.montant.toLocaleString()} FCFA</strong></p>
                    <p style="color: #666;">Entrez cet ID dans l'application CTL-Pay</p>
                </div>
            `;
        }
        
        paiementSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    demarrerTimerExpiration() {
        if (this.timerExpiration) clearInterval(this.timerExpiration);
        
        const timerElement = document.getElementById('expiration-timer');
        let tempsRestant = 10 * 60;
        
        this.timerExpiration = setInterval(() => {
            tempsRestant--;
            const minutes = Math.floor(tempsRestant / 60);
            const secondes = tempsRestant % 60;
            timerElement.textContent = `${minutes}:${secondes.toString().padStart(2, '0')}`;
            
            if (tempsRestant <= 0) {
                clearInterval(this.timerExpiration);
                this.transactionExpiree();
            }
        }, 1000);
    }
    
    transactionExpiree() {
        const statutElement = document.getElementById('statut-paiement');
        statutElement.innerHTML = '❌ Transaction expirée';
        statutElement.className = 'statut-paiement error';
        this.afficherNotification('❌ Transaction expirée', 'error');
    }
    
    async verifierStatutTransaction() {
        if (!this.transactionEnCours || !this.estConnecte) return;
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionEnCours.id}`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const transaction = result.data;
                const statutElement = document.getElementById('statut-paiement');
                
                if (transaction.statut === 'paye') {
                    statutElement.innerHTML = '✅ Paiement réussi! Distribution en cours...';
                    statutElement.className = 'statut-paiement success';
                    
                    await this.chargerSolde();
                    
                    if (this.timerExpiration) clearInterval(this.timerExpiration);
                    
                    this.afficherNotification('🎉 Paiement réussi! Boissons en distribution', 'success');
                    
                    setTimeout(() => {
                        this.reinitialiserApresPaiement();
                    }, 5000);
                } else if (transaction.statut === 'annule') {
                    statutElement.innerHTML = '❌ Transaction annulée';
                    statutElement.className = 'statut-paiement error';
                    if (this.timerExpiration) clearInterval(this.timerExpiration);
                } else if (transaction.statut === 'expire') {
                    statutElement.innerHTML = '❌ Transaction expirée';
                    statutElement.className = 'statut-paiement error';
                    if (this.timerExpiration) clearInterval(this.timerExpiration);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la vérification du statut:', error);
        }
    }
    
    reinitialiserApresPaiement() {
        this.panier = [];
        this.transactionEnCours = null;
        this.timerExpiration = null;
        
        document.getElementById('paiement-section').style.display = 'none';
        document.getElementById('statut-paiement').className = 'statut-paiement';
        document.getElementById('statut-paiement').innerHTML = '<div class="loader"></div><span>En attente de paiement...</span>';
        
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
    }
    
    modifierCommande() {
        this.panier = [];
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.afficherNotification('✏️ Commande modifiée', 'info');
    }
    
    async annulerPaiement() {
        if (this.transactionEnCours && this.estConnecte) {
            try {
                await fetch(`${this.API_URL}/api/transaction/${this.transactionEnCours.id}/annuler`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Erreur lors de l\'annulation:', error);
            }
        }
        
        if (this.timerExpiration) clearInterval(this.timerExpiration);
        this.reinitialiserApresPaiement();
        this.afficherNotification('❌ Transaction annulée', 'warning');
    }
    
    async chargerSolde() {
        try {
            const response = await fetch(`${this.API_URL}/api/solde/distributeur`);
            
            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('solde-distributeur').textContent = result.solde.toLocaleString();
            }
        } catch (error) {
            console.error('Erreur lors du chargement du solde:', error);
        }
    }
}

// Initialiser le distributeur
document.addEventListener('DOMContentLoaded', function() {
    window.distributeur = new DistributeurCTL();
});
