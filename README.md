<div align="center">
  <h1>🎤 Suivi-Rapstar</h1>
  <p><strong>Gestion daccréditations photo pour concerts et événements.</strong></p>

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Langue](https://img.shields.io/badge/langue-Fran%C3%A7ais-blue)
![Licence](https://img.shields.io/badge/licence-MIT-green)
</div>

---

## 📋 Sommaire
- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Technologies](#technologies)
- [Auteur](#auteur)

---

## 🎯 Présentation
Application web de gestion daccréditations photo pour les concerts. Permet aux médias et photographes de suivre leurs demandes daccréditation, de la proposition à la confirmation. Gère les tourneurs, les pipelines de statuts personnalisables, et exporte des dossiers PDF.

---

## ✨ Fonctionnalités
- ✅ Gestion CRUD complète des concerts (artiste, lieu, dates, contacts)
- ✅ Pipeline de statuts personnalisable (Idée → Envoyée → Obtenue/Refus)
- ✅ Export PDF des dossiers daccréditation
- ✅ Gestion des tourneurs et contacts
- ✅ Code couleur urgence (rouge/jaune/vert)
- ✅ Historique des modifications et détection de conflits
- ✅ Upload de logo personnalisé

---

## 🚀 Installation

```bash
git clone https://github.com/MattiaPARRINELLO/Suivi-Rapstar.git
cd Suivi-Rapstar
npm install
cp .env.example .env
# Configurez vos identifiants dans .env
npm start
```

---

## 🛠️ Technologies

| Technologie | Rôle |
|-------------|------|
| Node.js | Serveur backend |
| Express 5 | Framework web |
| EJS | Templates |
| PDFKit | Génération PDF |
| Multer | Upload fichiers |

---

<div align="center">
  <sub>Fait avec ❤️ par <a href="https://github.com/MattiaPARRINELLO">MattiaPARRINELLO</a></sub>
</div>
