const cookieParser = require('cookie-parser');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const MAX_ATTEMPTS = 5;
const COOLDOWN_PERIOD = 30;

/* functii */
const { verificaRaspunsuri, calculeazaRaspunsuriCorecte,incarcaUtilizatori,requireLogin  } = require('./public/functii');

/* variabila */
const{listaIntrebari} = require('./public/functii');

const app = express();
const port = 6789;

app.use(cookieParser());
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'SecretDatas',
  resave: false,
  saveUninitialized: true
}));

app.set('view engine', 'ejs');
app.set('views', './views');


const path = require('path');
const utilizatoriFilePath = path.join(__dirname, 'public', 'utilizatori.json');


let db = new sqlite3.Database('cumparaturi.db');
db.serialize(() => {
    db.run('CREATE TABLE IF NOT EXISTS produse (id INTEGER PRIMARY KEY, nume TEXT, pret REAL, cantitate INTEGER)', (err) => {
        if (err) {
            console.error('Eroare la crearea tabelei:', err.message);
        } else {
            console.log('Tabela "produse" a fost creată sau există deja.');
        }
    });
});

const db_util = new sqlite3.Database('utilizatori.db');
db_util.serialize(() => {
    db_util.run(`CREATE TABLE IF NOT EXISTS utilizatori (
        id INTEGER PRIMARY KEY,
        numeUtilizator TEXT UNIQUE,
        parola TEXT,
        nume TEXT,
        prenume TEXT,
        rol TEXT DEFAULT 'user'
    )`);
});

/* **************************************************************************************************************************************************** */
/*  *************************************                  cookie si logare                                             ************************************* */
/* **************************************************************************************************************************************************** */

app.get('/', (req, res) => {
    db_util.serialize(() => {
        db_util.run('CREATE TABLE IF NOT EXISTS utilizatori (id INTEGER PRIMARY KEY, numeUtilizator TEXT, parola TEXT, nume TEXT, prenume TEXT, rol TEXT)', (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
                return res.status(500).send('Error creating table.');
            }
            console.log('Tabelul "utilizatori" a fost creat cu succes în baza de date "utilizatori.db"!');

            // verific admin
            db_util.get('SELECT * FROM utilizatori WHERE numeUtilizator = ?', ['admin'], (err, row) => {
                if (err) {
                    console.error('Error checking for admin user:', err.message);
                    return res.status(500).send('Error checking for admin user.');
                }

                if (!row) {
                    console.log('Admin user does not exist. Inserting admin user.');

                    // adaug adminu
                    const stmt = db_util.prepare('INSERT INTO utilizatori (numeUtilizator, parola, nume, prenume, rol) VALUES (?, ?, ?, ?, ?)');
                    stmt.run('admin', 'admin', 'AquiLa', 'Diablo', 'admin', (err) => {
                        if (err) {
                            console.error('Error inserting admin user:', err.message);
                            return res.status(500).send('Error inserting admin user.');
                        }
                        console.log('Admin user inserted successfully.');
                    });
                    stmt.finalize();
                } else {
                    console.log('Admin user already exists.');
                }

                const utilizator = req.session.utilizator;
                res.render('layout', { utilizator, intrebari: listaIntrebari });
            });
        });
    });
});


app.get('/autentificare', (req, res) => {
    res.clearCookie('mesajEroare');
    const mesajEroare = req.cookies.mesajEroare || '';
    res.render('autentificare', { mesajEroare });
});


app.get('/delogare', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

app.get('/utilizatori_db', (req, res) => {
    db_util.serialize(() => {
        db_util.run('CREATE TABLE IF NOT EXISTS utilizatori (id INTEGER PRIMARY KEY, numeUtilizator TEXT, parola TEXT, nume TEXT, prenume TEXT, rol TEXT)');
        console.log('Tabelul "utilizatori" a fost creat cu succes în baza de date "utilizatori.db"!');
    });
    res.send('Baza de date "utilizatori.db" a fost creată cu succes.');
});


app.get('/creare-cont', (req, res) => {
    const utilizator = req.session.utilizator;
    const isAdmin = utilizator && utilizator.rol === 'admin';
    const message = '';
    res.render('creare-cont', { utilizator, isAdmin, message });
});

app.post('/creare-cont', (req, res) => {
    const { numeUtilizator, parola, nume, prenume } = req.body;

    db_util.get('SELECT * FROM utilizatori WHERE numeUtilizator = ?', [numeUtilizator], (err, row) => {
        if (err) {
            console.error('Eroare la căutarea utilizatorului:', err.message);
            return res.status(500).send('Eroare la căutarea utilizatorului.');
        }
        
        if (row) {
            const errorMessage = `Numele utilizatorului "${numeUtilizator}" este deja folosit. Te rugăm să alegi alt nume.`;
            console.error(`Eroare la inserarea utilizatorului: ${errorMessage}`);
            const alertScript = `<script>alert('${errorMessage}'); window.location.href = "/creare-cont";</script>`;
            return res.send(alertScript);
        } else {
            db_util.run('INSERT INTO utilizatori (numeUtilizator, parola, nume, prenume, rol) VALUES (?, ?, ?, ?, ?)', [numeUtilizator, parola, nume, prenume, 'user'], (err) => {
                if (err) {
                    console.error('Eroare la inserarea utilizatorului:', err.message);
                    return res.status(500).send('Eroare la inserarea utilizatorului.');
                }
                const successMessage = 'Contul a fost creat cu succes!';
                const alertScript = `<script>alert('${successMessage}'); window.location.href = "/autentificare";</script>`;
                res.send(alertScript);
            });
        }
    });
});


app.post('/verificare-autentificare', (req, res) => {
    const { utilizator, parola } = req.body;
    const maxAttempts = 3;      // 3 incercari max
    const lockoutTime = 5000;   // 5 secunde

    req.session.failedLoginAttempts = req.session.failedLoginAttempts || 0;

    if (req.session.failedLoginAttempts >= maxAttempts) {
        const elapsedTime = Date.now() - req.session.lastFailedLoginTime;
        const remainingTime = Math.max(lockoutTime - elapsedTime, 0);
        if (remainingTime === 0) {
            req.session.failedLoginAttempts = 0;
            req.session.lastFailedLoginTime = null;
        } else {
            const message = `Ai atins ${maxAttempts} încercări de autentificare eșuate! Așteaptă ${Math.ceil(remainingTime / 1000)} secunde.`;
            res.cookie('mesajEroare', message);
            return res.redirect('/autentificare');
        }
    }

    db_util.get('SELECT * FROM utilizatori WHERE numeUtilizator = ? AND parola = ?', [utilizator, parola], (err, row) => {
        if (err) {
            console.error('Eroare la verificarea autentificării:', err.message);
            return res.status(500).send('Eroare la verificarea autentificării.');
        }
        
        if (row) {
            req.session.utilizator = {
                nume: row.nume,
                prenume: row.prenume,
                rol: row.rol
            };
            req.session.failedLoginAttempts = 0;
            req.session.lastFailedLoginTime = null;
            res.clearCookie('mesajEroare');
            res.redirect('/');
        } else {
            req.session.failedLoginAttempts++;
            req.session.lastFailedLoginTime = Date.now();
            const message = 'Utilizator sau parolă incorecte';
            res.cookie('mesajEroare', message);
            res.redirect('/autentificare');
        }
    });
});


/* **************************************************************************************************************************************************** */
/*  *************************************                  chestionar                                             ************************************* */
/* **************************************************************************************************************************************************** */

app.get('/chestionar', requireLogin, (req, res) => {
    const utilizator = req.session.utilizator;
    res.render('chestionar', { utilizator, intrebari: listaIntrebari });
});




app.post('/rezultat-chestionar', (req, res) => {
    const raspunsuri = req.body;
    const numarRaspunsuriCorecte = calculeazaRaspunsuriCorecte(raspunsuri, listaIntrebari);
    const toateIntrebarileRaspunse = verificaRaspunsuri(raspunsuri, listaIntrebari.length);

    if (toateIntrebarileRaspunse) {
        res.render('rezultat-chestionar', { numarRaspunsuriCorecte, totalIntrebari: listaIntrebari.length });
    } else {
        res.send('<script>alert("Vă rugăm să răspundeți la toate întrebările înainte de a trimite formularul."); window.history.back();</script>');
    }
});





/* **************************************************************************************************************************************************** */
/*  *************************************                  baza de date                                             ************************************* */
/* **************************************************************************************************************************************************** */

app.get('/creare-bd', requireLogin, (req, res) => {
    db.serialize(() => {
        db.run('CREATE TABLE IF NOT EXISTS produse (id INTEGER PRIMARY KEY, nume TEXT, pret REAL, cantitate INTEGER)');
        console.log('Tabelul "produse" a fost creat cu succes în baza de date "cumparaturi.db"!');
    });
    res.send('Baza de date "cumparaturi.db" a fost creată cu succes.');
});

app.get('/inserare-db', requireLogin, (req, res) => {
    const utilizator = req.session.utilizator;
    const isAdmin = utilizator && utilizator.rol === 'admin';
    const message = '';
    res.render('inserare-db', { utilizator, isAdmin, message });
});


app.post('/inserare-bd', requireLogin, (req, res) => {
    const { nume, pret, cantitate } = req.body;

    db.get('SELECT * FROM produse WHERE nume = ?', [nume], (err, row) => {
        if (err) {
            console.error('Eroare la căutarea produsului:', err.message);
            res.status(500).send('Eroare la căutarea produsului.');
            return;
        }

        if (row) {
            const cantitateNoua = row.cantitate + parseInt(cantitate);
            db.run('UPDATE produse SET cantitate = ? WHERE nume = ?', [cantitateNoua, nume], err => {
                if (err) {
                    console.error('Eroare la actualizarea cantității:', err.message);
                    res.status(500).send('Eroare la actualizarea cantității.');
                } else {
                    console.log('Cantitatea produsului a fost actualizată cu succes.');
                    res.redirect('/inserare-db');
                }
            });
        } else {
            db.serialize(() => {
                const stmt = db.prepare('INSERT INTO produse (nume, pret, cantitate) VALUES (?, ?, ?)');
                stmt.run(nume, pret, cantitate, (err) => {
                    if (err) {
                        console.error('Eroare la inserarea datelor:', err.message);
                        res.status(500).send('Eroare la inserarea datelor.');
                    } else {
                        console.log('Produsul a fost inserat în baza de date cu succes.');
                        res.redirect('/inserare-db');
                    }
                });
                stmt.finalize();
            });
        }
    });
});

app.post('/inserare-db-json', requireLogin, upload.single('file'), (req, res) => {
    const { file } = req;

    try {
        const jsonData = JSON.parse(fs.readFileSync(file.path, 'utf8'));
        let responseSent = false;

        jsonData.forEach(({ nume, pret, cantitate }) => {
            db.get('SELECT * FROM produse WHERE nume = ?', [nume], (err, row) => {
                if (err) {
                    console.error('Eroare la căutarea produsului:', err.message);
                    if (!responseSent) {
                        res.status(500).send('Eroare la căutarea produsului.');
                        responseSent = true;
                    }
                    return;
                }

                if (row) {
                    const cantitateNoua = row.cantitate + cantitate;
                    db.run('UPDATE produse SET cantitate = ? WHERE nume = ?', [cantitateNoua, nume], err => {
                        if (err) {
                            console.error('Eroare la actualizarea cantității:', err.message);
                            if (!responseSent) {
                                res.status(500).send('Eroare la actualizarea cantității.');
                                responseSent = true;
                            }
                        } else {
                            console.log('Cantitatea produsului a fost actualizată cu succes.');
                            if (!responseSent) {
                                res.redirect('/inserare-db');
                                responseSent = true;
                            }
                        }
                    });
                } else {
                    db.run('INSERT INTO produse (nume, pret, cantitate) VALUES (?, ?, ?)', [nume, pret, cantitate], err => {
                        if (err) {
                            console.error('Eroare la inserarea datelor:', err.message);
                            if (!responseSent) {
                                res.status(500).send('Eroare la inserarea datelor.');
                                responseSent = true;
                            }
                        } else {
                            console.log('Produsul a fost inserat în baza de date cu succes.');
                            if (!responseSent) {
                                res.redirect('/inserare-db');
                                responseSent = true;
                            }
                        }
                    });
                }
            });
        });
    } catch (error) {
        console.error('Eroare la citirea fișierului JSON:', error.message);
        if (!responseSent) {
            res.status(500).send('Eroare la citirea fișierului JSON.');
            responseSent = true;
        }
    }
});

app.get('/afisare-db', requireLogin, (req, res) => {
    db.all('SELECT * FROM produse', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Eroare la citirea datelor din baza de date.');
        } else {
            res.render('afisare-db', { produse: rows });
        }
    });
});


/* **************************************************************************************************************************************************** */
/*  *************************************                  shopping                                             ************************************* */
/* **************************************************************************************************************************************************** */


app.get('/shopping', requireLogin, (req, res) => {
    db.all('SELECT * FROM produse', (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).send('Eroare la citirea datelor din baza de date.');
        } else {
            const cart = req.session.cart || [];
            res.render('shopping', { produse: rows, cart });
        }
    });
});

app.post('/add-to-cart', requireLogin, (req, res) => {
    const { nume, cantitate } = req.body;
    const cart = req.session.cart || [];

    db.get('SELECT * FROM produse WHERE nume = ?', [nume], (err, produs) => {
        if (err) {
            console.error('Eroare la căutarea produsului:', err.message);
            return res.status(500).send('Eroare la căutarea produsului.');
        }

        if (produs && produs.cantitate >= cantitate) {
            const existingProduct = cart.find(item => item.nume === nume);
            if (existingProduct) {
                existingProduct.cantitate += parseInt(cantitate);
                if (existingProduct.cantitate > produs.cantitate) {
                    existingProduct.cantitate = produs.cantitate;
                }
            } else {
                cart.push({ nume, cantitate: parseInt(cantitate) });
            }
            req.session.cart = cart;
            res.redirect('/shopping');
        } else {
            res.status(400).send('Cantitate insuficientă în stoc.');
        }
    });
});

app.get('/vizualizare-cos', requireLogin, (req, res) => {
    const cart = req.session.cart || [];
    res.render('vizualizare-cos', { cart });
});

app.post('/finalizeaza-cumparaturile', requireLogin, (req, res) => {
    const cart = req.session.cart || [];

    if (cart.length === 0) {
        return res.redirect('/vizualizare-cos');
    }

    db.serialize(() => {
        cart.forEach(item => {
            db.run('UPDATE produse SET cantitate = cantitate - ? WHERE nume = ? AND cantitate >= ?', [item.cantitate, item.nume, item.cantitate], (err) => {
                if (err) {
                    console.error('Eroare la actualizarea cantității:', err.message);
                }
            });
        });
    });

    req.session.cart = [];
    res.send('<script>alert("Multumesc ca ati cumparat de la noi!"); window.location.href = "/shopping";</script>');
});



app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:${port}`));



/* ************************************************************************** */
/*    date                                   **************************************/
/* ************************************************************************** */