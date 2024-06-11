const fs = require('fs');
const path = require('path');

const utilizatoriFilePath = path.join(__dirname, 'public', 'utilizatori.json');
const listaIntrebari = [
    {
        intrebare: 'Care este cel mai comun format de fișier pentru imagini?',
        variante: ['JPEG', 'GIF', 'PNG', 'TIFF'],
        corect: 0
    },
    {
        intrebare: 'Ce este o diafragmă în fotografie?',
        variante: ['O aplicație de editare foto', 'Un obiectiv specializat', 'Un element de control al expunerii', 'Un tip de blitz'],
        corect: 2
    },
    {
        intrebare: 'Ce reprezintă ISO în fotografie?',
        variante: ['International Standard Organization', 'O organizație de standarde internaționale', 'Sensibilitatea senzorului la lumină', 'O unitate de măsură pentru claritatea imaginii'],
        corect: 2
    },
    {
        intrebare: 'Ce este "Bokeh"?',
        variante: ['Un efect optic care constă în estomparea fundalului', 'Un termen japonez pentru "focalizare rapidă"', 'O tehnică de iluminare', 'Un tip de lentilă specială'],
        corect: 0
    },
    {
        intrebare: 'Ce este un obiectiv grandangular?',
        variante: ['Un obiectiv cu zoom puternic', 'Un obiectiv care acoperă un unghi mare de vizualizare', 'Un obiectiv care produce imagini cu suprafețe distorsionate', 'Un obiectiv cu distanță focală mică'],
        corect: 1
    },
    {
        intrebare: 'Care este funcția unui trepied în fotografie?',
        variante: ['Stabilizarea imaginii', 'Îmbunătățirea focalizării', 'Fotografierea în mișcare rapidă', 'Creșterea expunerii'],
        corect: 0
    },
    {
        intrebare: 'Ce este balansul de alb în fotografie?',
        variante: ['O tehnologie de iluminare a scenei', 'Un dispozitiv pentru măsurarea temperaturii culorilor', 'O setare a aparatului foto care ajustează culorile pentru a reflecta lumina ambientală', 'Un tip de film fotografic'],
        corect: 2
    },
    {
        intrebare: 'Ce este distanța focală a unui obiectiv?',
        variante: ['Distanța maximă la care poate focaliza un obiectiv', 'Capacitatea unui obiectiv de a captura detalii fine', 'Raportul dintre dimensiunea senzorului și mărimea efectivă a imaginii', 'Distanța dintre punctul de focalizare și senzorul aparatului foto'],
        corect: 3
    },
    {
        intrebare: 'Care este scopul unui filtru polarizant în fotografie?',
        variante: ['Redarea culorilor mai vii și mai saturate', 'Blocarea luminii excesive', 'Reducerea efectului de ochi roșii', 'Protecția obiectivului împotriva zgârieturilor'],
        corect: [2, 3]
    },
    {
        intrebare: 'Ce este timpul de expunere în fotografie?',
        variante: ['Durata pentru care aparatul foto este deschis pentru a captura lumină', 'O setare care controlează luminozitatea imaginii', 'Perioada în care obiectivul este focalizat', 'Viteza de focalizare a obiectivului'],
        corect: 0
    }
];

function verificaRaspunsuri(raspunsuri, totalIntrebari) {
    const numarRaspunsuri = Object.keys(raspunsuri).length;
    return numarRaspunsuri === totalIntrebari;
}

function verificaAutentificare(utilizator, parola) {
    const utilizatorCorect = 'admin';
    const parolaCorecta = 'admin';

    return utilizator === utilizatorCorect && parola === parolaCorecta;
}

function calculeazaRaspunsuriCorecte(raspunsuri) {
    let numarRaspunsuriCorecte = 0;

    listaIntrebari.forEach((intrebare, index) => {
        if (raspunsuri[`intrebare${index}`] == intrebare.corect) {
            numarRaspunsuriCorecte++;
        }
    });

    return numarRaspunsuriCorecte;
}

function incarcaUtilizatori() {
    const fs = require('fs');
    const utilizatoriJSON = fs.readFileSync('./public/utilizatori.json');
    return JSON.parse(utilizatoriJSON);
}

function moveElementLeftAndRight(element) {
    const moveLeft = () => {
        element.style.transform = 'translateX(-100%)'; 
        setTimeout(moveRight, 2000);
    }

    const moveRight = () => {
        element.style.transform = 'translateX(100%)'; 
        setTimeout(moveLeft, 2000); 
    }
    moveLeft();
}

function requireLogin(req, res, next) {
    if (!req.session.utilizator) {
        return res.redirect('/autentificare');
    }
    next();
}




module.exports = { verificaRaspunsuri,verificaAutentificare,calculeazaRaspunsuriCorecte,incarcaUtilizatori,listaIntrebari,requireLogin};





