const mysql = require('mysql');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'Tasmia',
    password: 'Tasmia31@',
    database: 'medical_centre'
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL');
});

module.exports = db;
