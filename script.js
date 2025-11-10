class Distributeur {
    constructor() {
        this.panier = [];
        this.transactionEnCours = null;
        this.timerExpiration = null;
        this.API_URL = CONFIG.API_URL;
        this.estConnecte = false;
        this.stats = {
            chiffreAffaire: 0,
            ventes: 0,
            transactions: 0
        };
        
        this.init();
    }
    
    async init() {
        await this.testerConnexionServeur();
        this.afficherBoissons();
        this.chargerSolde();
        this.chargerStats();
        this.setupEventListeners();
        this.setupNavigation();
        
        // Vérifier périodiquement
        setInterval(() => this.verifierStatutTransaction(), 2000);
        setInterval(() => this.testerConnexionServeur(), 30000);
    }
    
    setupNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.getAttribute('data-section');
                this.changerSection(section);
            });
        });
    }
    
    changerSection(section) {
        // Mettre à jour les boutons de navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Afficher la section correspondante
        document.querySelectorAll('.content-section').forEach(sect => {
            sect.classList.remove('active');
        });
        document.getElementById(`${section}-section`).classList.add('active');
    }
    
    async testerConnexionServeur() {
        try {
            const response = await fetch(`${this.API_URL}/api/health`);
            if (!response.ok) throw new Error('API non disponible');
            
            this.estConnecte = true;
            this.mettreAJourStatutConnexion(true);
            return true;
        } catch (error) {
            console.error('Erreur connexion serveur:', error);
            this.estConnecte = false;
            this.mettreAJourStatutConnexion(false);
            return false;
        }
    }
    
    mettreAJourStatutConnexion(connecte) {
        const statutElement = document.getElementById('statut-serveur');
        const footerStatut = document.getElementById('footer-statut');
        
        if (connecte) {
            statutElement.innerHTML = '<div class="statut-point"></div><span>En ligne</span>';
            statutElement.style.background = 'rgba(76, 175, 80, 0.2)';
            footerStatut.textContent = 'Connecté';
            footerStatut.style.color = '#4CAF50';
        } else {
            statutElement.innerHTML = '<div class="statut-point" style="background: #f44336;"></div><span>Hors ligne</span>';
            statutElement.style.background = 'rgba(244, 67, 54, 0.2)';
            footerStatut.textContent = 'Déconnecté';
            footerStatut.style.color = '#f44336';
        }
    }
    
    afficherBoissons() {
        const grid = document.getElementById('boissons-grid');
        grid.innerHTML = '';
        
        BOISSONS.forEach(boisson => {
            const card = document.createElement('div');
            card.className = 'boisson-card';
            if (boisson.populaire) {
                card.innerHTML += '<div class="boisson-populaire">🌟 POPULAIRE</div>';
            }
            
            card.innerHTML += `
                <div class="boisson-image">
                    <img src="${boisson.image}" alt="${boisson.nom}" onerror="this.src='https://via.placeholder.com/200x200/667eea/ffffff?text=🥤'">
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
            this.afficherNotification('❌ Maximum 2 boissons autorisées', 'error');
            return;
        }
        
        if (this.panier.find(item => item.id === boisson.id)) {
            this.afficherNotification('❌ Cette boisson est déjà sélectionnée', 'error');
            return;
        }
        
        this.panier.push(boisson);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.afficherNotification(`✅ ${boisson.nom} ajoutée au panier`, 'success');
    }
    
    retirerDuPanier(boissonId) {
        const boisson = this.panier.find(item => item.id === boissonId);
        this.panier = this.panier.filter(item => item.id !== boissonId);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.afficherNotification(`🗑️ ${boisson.nom} retirée du panier`, 'info');
    }
    
    mettreAJourPanier() {
        const panierElement = document.getElementById('panier');
        const totalElement = document.getElementById('total-panier');
        
        if (this.panier.length === 0) {
            panierElement.innerHTML = `
                <div class="panier-vide">
                    <div class="empty-icon">🥤</div>
                    <p>Aucune boisson sélectionnée</p>
                </div>
            `;
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
            this.afficherNotification('❌ Impossible de se connecter au serveur', 'error');
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
            
            const result = await response.json();
            
            if (result.success) {
                this.transactionEnCours = result.data;
                this.afficherQRCode(result.data);
                this.demarrerTimerExpiration();
                this.changerSection('paiement');
            } else {
                throw new Error(result.error || 'Erreur lors de la création de la transaction');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.afficherNotification('❌ Erreur: ' + error.message, 'error');
        }
    }
    
    afficherQRCode(transaction) {
        const qrCodeElement = document.getElementById('qr-code');
        const transactionIdElement = document.getElementById('transaction-id');
        const montantTransactionElement = document.getElementById('montant-transaction');
        
        // Mettre à jour les informations
        transactionIdElement.textContent = transaction.id;
        montantTransactionElement.textContent = transaction.montant.toLocaleString() + ' FCFA';
        
        // Générer le QR code
        qrCodeElement.innerHTML = '';
        
        const qrData = JSON.stringify({
            transactionId: transaction.id,
            montant: transaction.montant,
            apiUrl: this.API_URL,
            timestamp: Date.now()
        });
        
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
                    <h3 style="margin-bottom: 15px;">📱 ID Transaction</h3>
                    <p style="font-size: 24px; font-weight: bold; margin: 20px 0; color: #667eea;">${transaction.id}</p>
                    <p style="font-size: 18px; margin: 10px 0;">Montant: ${transaction.montant.toLocaleString()} FCFA</p>
                    <p style="opacity: 0.7;">Entrez cet ID dans l'application CTL-PAY</p>
                </div>
            `;
        }
    }
    
    demarrerTimerExpiration() {
        if (this.timerExpiration) clearInterval(this.timerExpiration);
        
        const timerElement = document.getElementById('expiration-timer');
        let tempsRestant = 10 * 60; // 10 minutes
        
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
        statutElement.style.color = '#f44336';
    }
    
    async verifierStatutTransaction() {
        if (!this.transactionEnCours || !this.estConnecte) return;
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionEnCours.id}`);
            const result = await response.json();
            
            if (result.success) {
                const transaction = result.data;
                const statutElement = document.getElementById('statut-paiement');
                
                if (transaction.statut === 'paye') {
                    statutElement.innerHTML = '✅ Paiement réussi! Distribution en cours...';
                    statutElement.style.color = '#4CAF50';
                    
                    // Jouer le son de succès
                    this.jouerSon('scan');
                    
                    // Mettre à jour les stats
                    this.stats.chiffreAffaire += transaction.montant;
                    this.stats.ventes += transaction.boissons.length;
                    this.stats.transactions++;
                    this.mettreAJourStats();
                    
                    if (this.timerExpiration) clearInterval(this.timerExpiration);
                    
                    // Réinitialiser après 3 secondes
                    setTimeout(() => {
                        this.reinitialiserApresPaiement();
                        this.changerSection('boissons');
                        this.afficherNotification('🎉 Paiement réussi! Merci pour votre achat', 'success');
                    }, 3000);
                }
            }
        } catch (error) {
            console.error('Erreur vérification statut:', error);
        }
    }
    
    jouerSon(type) {
        const audio = document.getElementById('sound-scan');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.log('Son non joué:', e));
        }
    }
    
    reinitialiserApresPaiement() {
        this.panier = [];
        this.transactionEnCours = null;
        this.timerExpiration = null;
        
        document.getElementById('statut-paiement').innerHTML = '<div class="loader"></div> En attente de paiement...';
        document.getElementById('statut-paiement').style.color = 'white';
        
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.chargerSolde();
    }
    
    modifierCommande() {
        this.panier = [];
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
        this.afficherNotification('🔄 Commande modifiée', 'info');
    }
    
    async annulerPaiement() {
        if (this.transactionEnCours) {
            try {
                await fetch(`${this.API_URL}/api/transaction/${this.transactionEnCours.id}/annuler`, {
                    method: 'POST'
                });
            } catch (error) {
                console.error('Erreur annulation:', error);
            }
        }
        
        if (this.timerExpiration) clearInterval(this.timerExpiration);
        this.reinitialiserApresPaiement();
        this.changerSection('boissons');
        this.afficherNotification('❌ Transaction annulée', 'info');
    }
    
    async chargerSolde() {
        try {
            const response = await fetch(`${this.API_URL}/api/solde/distributeur`);
            const result = await response.json();
            
            if (result.success) {
                document.getElementById('solde-distributeur').textContent = 
                    Math.round(result.solde).toLocaleString();
            }
        } catch (error) {
            console.error('Erreur chargement solde:', error);
        }
    }
    
    async chargerStats() {
        // Simulation des stats - dans une vraie app, récupérer depuis l'API
        this.stats = {
            chiffreAffaire: 125000,
            ventes: 89,
            transactions: 45
        };
        this.mettreAJourStats();
    }
    
    mettreAJourStats() {
        document.getElementById('stat-chiffre-affaire').textContent = 
            this.stats.chiffreAffaire.toLocaleString() + ' FCFA';
        document.getElementById('stat-ventes').textContent = this.stats.ventes;
        document.getElementById('stat-transactions').textContent = this.stats.transactions;
    }
    
    afficherNotification(message, type = 'info') {
        // Créer une notification temporaire
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 10000;
            backdrop-filter: blur(20px);
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        
        if (type === 'success') {
            notification.style.background = 'rgba(76, 175, 80, 0.9)';
        } else if (type === 'error') {
            notification.style.background = 'rgba(244, 67, 54, 0.9)';
        } else {
            notification.style.background = 'rgba(33, 150, 243, 0.9)';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Initialiser le distributeur
document.addEventListener('DOMContentLoaded', function() {
    window.distributeur = new Distributeur();
});

// Ajouter les animations CSS pour les notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
