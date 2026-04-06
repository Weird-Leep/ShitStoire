// Shared tooltips and link resolver for temporal and sequential timelines

window.TooltipManager = {
    // Cache for entities and links
    data: {
        links: {},
        entities: {}
    },
    initialized: false,
    el: null,

    async init() {
        if(this.initialized) return;
        this.el = document.getElementById('custom-tooltip');
        
        // Setup mouse tracking to move tooltip
        document.addEventListener('mousemove', (e) => {
            if (this.el.style.display === 'block') {
                // Keep it on screen
                let left = e.pageX + 15;
                let top = e.pageY + 15;
                if (left + this.el.offsetWidth > window.innerWidth) {
                    left = e.pageX - this.el.offsetWidth - 15;
                }
                this.el.style.left = left + 'px';
                this.el.style.top = top + 'px';
            }
        });

        await this.fetchAllData();
        this.initialized = true;
    },

    async fetchAllData() {
        // Fetch all link tables and entities needed to build tooltips
        const endpoints = {
            'Lien_evenement_personnage': fetch('/api/links/Lien_evenement_personnage').then(r=>r.json()),
            'Lien_evenement_lieux': fetch('/api/links/Lien_evenement_lieux').then(r=>r.json()),
            'Lien_personnage_lieux': fetch('/api/links/Lien_personnage_lieux').then(r=>r.json()),
            'Lien_personnage_entite_politique': fetch('/api/links/Lien_personnage_entite_politique').then(r=>r.json()),
            'Lien_lieu_entite_politique': fetch('/api/links/Lien_lieu_entite_politique').then(r=>r.json()),
            'Personnages': fetch('/api/entities/Personnages').then(r=>r.json()),
            'Evenement': fetch('/api/entities/Evenement').then(r=>r.json()),
            'Lieu': fetch('/api/entities/Lieu').then(r=>r.json()),
            'Entite_politique': fetch('/api/entities/Entite_politique').then(r=>r.json())
        };

        const results = {};
        for (const [key, promise] of Object.entries(endpoints)) {
            try {
                results[key] = await promise;
            } catch (err) {
                console.error(`Failed to fetch ${key}:`, err);
                results[key] = [];
            }
        }

        this.data.links = {
            ev_pe: results['Lien_evenement_personnage'],
            ev_lieu: results['Lien_evenement_lieux'],
            pe_lieu: results['Lien_personnage_lieux'],
            pe_ep: results['Lien_personnage_entite_politique'],
            lieu_ep: results['Lien_lieu_entite_politique']
        };

        // Turn entity arrays into ID-maps for O(1) lookups
        this.data.entities = {
            'pe': Object.fromEntries(results['Personnages'].map(e => [e.ID, e])),
            'ev': Object.fromEntries(results['Evenement'].map(e => [e.ID, e])),
            'lieu': Object.fromEntries(results['Lieu'].map(e => [e.ID, e])),
            'ep': Object.fromEntries(results['Entite_politique'].map(e => [e.ID, e]))
        };
    },

    getConnected(type, id) {
        let connected = [];
        
        if (type === 'ev') {
            const pa_ids = this.data.links.ev_pe?.filter(l => l.ID_evenement == id).map(l => l.ID_personnage) || [];
            pa_ids.forEach(pid => this.data.entities.pe[pid] && connected.push(`Personnage : ${this.data.entities.pe[pid].Nom}`));
            
            const li_ids = this.data.links.ev_lieu?.filter(l => l.ID_evenement == id).map(l => l.ID_lieu) || [];
            li_ids.forEach(lid => this.data.entities.lieu[lid] && connected.push(`Lieu : ${this.data.entities.lieu[lid].Nom}`));
        } else if (type === 'pe') {
            const ev_ids = this.data.links.ev_pe?.filter(l => l.ID_personnage == id).map(l => l.ID_evenement) || [];
            ev_ids.forEach(eid => this.data.entities.ev[eid] && connected.push(`Évènement : ${this.data.entities.ev[eid].titre}`));
            
            const li_ids = this.data.links.pe_lieu?.filter(l => l.ID_personnage == id).map(l => l.ID_lieu) || [];
            li_ids.forEach(lid => this.data.entities.lieu[lid] && connected.push(`Lieu : ${this.data.entities.lieu[lid].Nom}`));
            
            const ep_ids = this.data.links.pe_ep?.filter(l => l.ID_personnage == id).map(l => l.ID_entite_politique) || [];
            ep_ids.forEach(epid => this.data.entities.ep[epid] && connected.push(`Entité Pol : ${this.data.entities.ep[epid].titre}`));
        } else if (type === 'ep') {
            const pe_ids = this.data.links.pe_ep?.filter(l => l.ID_entite_politique == id).map(l => l.ID_personnage) || [];
            pe_ids.forEach(pid => this.data.entities.pe[pid] && connected.push(`Personnage : ${this.data.entities.pe[pid].Nom}`));
            
            const li_ids = this.data.links.lieu_ep?.filter(l => l.ID_entite_politique == id).map(l => l.ID_lieu) || [];
            li_ids.forEach(lid => this.data.entities.lieu[lid] && connected.push(`Lieu : ${this.data.entities.lieu[lid].Nom}`));
        }
        return connected;
    },

    show(e, { type, id, title, start, end, description }) {
        if (!this.initialized) return;

        let datesStr = start ? new Date(start).toLocaleDateString() : '';
        if (end) datesStr += ' - ' + new Date(end).toLocaleDateString();

        let linksHTML = '';
        const connectedLines = this.getConnected(type, id);
        if (connectedLines.length > 0) {
            linksHTML = `
                <div class="tt-links">
                    <strong>Liens :</strong>
                    <ul>${connectedLines.map(l => `<li>${l}</li>`).join('')}</ul>
                </div>
            `;
        }

        let html = `
            <h4>${title || 'Sans titre'}</h4>
            ${datesStr ? `<div class="tt-dates">${datesStr}</div>` : ''}
            ${description ? `<div class="tt-desc">${description}</div>` : ''}
            ${linksHTML}
        `;
        
        this.el.innerHTML = html;
        this.el.style.display = 'block';
    },

    hide() {
        if(this.el) this.el.style.display = 'none';
    }
};
