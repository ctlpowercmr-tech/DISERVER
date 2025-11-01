class Distributeur {
    constructor() {
        this.panier = [];
        this.transactionEnCours = null;
        this.timerExpiration = null;
        this.API_URL = CONFIG.API_URL;
        
        this.init();
    }
    
    async init() {
        await this.verifierConnexionAPI();
        this.afficherBoissons();
        this.chargerSolde();
        this.setupEventListeners();
        
        // Vérifier périodiquement le statut des transactions
        setInterval(() => this.verifierStatutTransaction(), 2000);
    }
    
    async verifierConnexionAPI() {
        try {
            const response = await fetch(`${this.API_URL}/api/health`);
            if (!response.ok) throw new Error('API non disponible');
            console.log('✅ Connexion API établie');
        } catch (error) {
            console.error('❌ Erreur connexion API:', error);
            alert('Impossible de se connecter au serveur. Vérifiez votre connexion.');
        }
    }
    
    afficherBoissons() {
        const grid = document.getElementById('boissons-grid');
        grid.innerHTML = '';
        
        BOISSONS.forEach(boisson => {
            const card = document.createElement('div');
            card.className = 'boisson-card';
            card.innerHTML = `
                <div class="boisson-image" style="background: linear-gradient(45deg, ${boisson.couleur}, #ffffff)">
                    ${boisson.icone}
                </div>
                <div class="boisson-nom">${boisson.nom}</div>
                <div class="boisson-prix">${boisson.prix.toFixed(2)}€</div>
            `;
            
            card.addEventListener('click', () => this.ajouterAuPanier(boisson));
            grid.appendChild(card);
        });
    }
    
    ajouterAuPanier(boisson) {
        if (this.panier.length >= 2) {
            alert('Vous ne pouvez sélectionner que 2 boissons maximum');
            return;
        }
        
        if (this.panier.find(item => item.id === boisson.id)) {
            alert('Cette boisson est déjà dans votre sélection');
            return;
        }
        
        this.panier.push(boisson);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
    }
    
    retirerDuPanier(boissonId) {
        this.panier = this.panier.filter(item => item.id !== boissonId);
        this.mettreAJourPanier();
        this.mettreAJourBoutons();
    }
    
    mettreAJourPanier() {
        const panierElement = document.getElementById('panier');
        const totalElement = document.getElementById('total-panier');
        
        if (this.panier.length === 0) {
            panierElement.innerHTML = '<div class="vide">Aucune boisson sélectionnée</div>';
        } else {
            panierElement.innerHTML = '';
            this.panier.forEach(boisson => {
                const item = document.createElement('div');
                item.className = 'item-panier';
                item.innerHTML = `
                    <span>${boisson.icone} ${boisson.nom}</span>
                    <span>${boisson.prix.toFixed(2)}€</span>
                    <button onclick="distributeur.retirerDuPanier(${boisson.id})" class="btn-retirer">✕</button>
                `;
                panierElement.appendChild(item);
            });
        }
        
        const total = this.panier.reduce((sum, boisson) => sum + boisson.prix, 0);
        totalElement.textContent = total.toFixed(2);
    }
    
    mettreAJourBoutons() {
        const btnPayer = document.getElementById('btn-payer');
        const btnModifier = document.getElementById('btn-modifier');
        
        btnPayer.disabled = this.panier.length === 0;
        btnModifier.disabled = this.panier.length === 0;
    }
    
    setupEventListeners() {
        document.getElementById('btn-payer').addEventListener('click', () => this.demarrerPaiement());
        document.getElementById('btn-modifier').addEventListener('click', () => this.modifierCommande());
        document.getElementById('annuler-paiement').addEventListener('click', () => this.annulerPaiement());
    }
    
    async demarrerPaiement() {
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
            } else {
                throw new Error(result.error || 'Erreur lors de la création de la transaction');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert('Erreur: ' + error.message);
        }
    }
    
    afficherQRCode(transaction) {
        const paiementSection = document.getElementById('paiement-section');
        const qrCodeElement = document.getElementById('qr-code');
        const transactionIdElement = document.getElementById('transaction-id');
        const montantTransactionElement = document.getElementById('montant-transaction');
        
        // Afficher la section paiement
        paiementSection.style.display = 'block';
        
        // Mettre à jour les informations de transaction
        transactionIdElement.textContent = transaction.id;
        montantTransactionElement.textContent = transaction.montant.toFixed(2);
        
        // Générer le QR code avec les données de transaction
        qrCodeElement.innerHTML = '';
        const qrCode = new QRCode(qrCodeElement, {
            text: JSON.stringify({
                transactionId: transaction.id,
                montant: transaction.montant,
                type: 'paiement-boisson',
                apiUrl: this.API_URL
            }),
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Faire défiler jusqu'au QR code
        paiementSection.scrollIntoView({ behavior: 'smooth' });
    }
    
    demarrerTimerExpiration() {
        if (this.timerExpiration) clearInterval(this.timerExpiration);
        
        const timerElement = document.getElementById('expiration-timer');
        let tempsRestant = 10 * 60; // 10 minutes en secondes
        
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
    }
    
    async verifierStatutTransaction() {
        if (!this.transactionEnCours) return;
        
        try {
            const response = await fetch(`${this.API_URL}/api/transaction/${this.transactionEnCours.id}`);
            const result = await response.json();
            
            if (result.success) {
                const transaction = result.data;
                const statutElement = document.getElementById('statut-paiement');
                
                if (transaction.statut === 'paye') {
                    statutElement.innerHTML = '✅ Paiement réussi! Distribution en cours...';
                    statutElement.className = 'statut-paiement success';
                    
                    // Mettre à jour le solde du distributeur
                    this.soldeDistributeur += transaction.montant;
                    document.getElementById('solde-distributeur').textContent = this.soldeDistributeur.toFixed(2);
                    
                    if (this.timerExpiration) clearInterval(this.timerExpiration);
                    
                    // Réinitialiser après 5 secondes
                    setTimeout(() => {
                        this.reinitialiserApresPaiement();
                    }, 5000);
                } else if (transaction.statut === 'annule') {
                    statutElement.innerHTML = '❌ Transaction annulée';
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
    }
    
    async annulerPaiement() {
        if (this.transactionEnCours) {
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
    }
    
    async chargerSolde() {
        try {
            const response = await fetch(`${this.API_URL}/api/solde/distributeur`);
            const result = await response.json();
            
            if (result.success) {
                this.soldeDistributeur = result.solde;
                document.getElementById('solde-distributeur').textContent = this.soldeDistributeur.toFixed(2);
            }
        } catch (error) {
            console.error('Erreur lors du chargement du solde:', error);
        }
    }
}

// Initialiser le distributeur
const distributeur = new Distributeur();