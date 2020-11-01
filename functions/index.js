const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const express = require('express');
const api = express();
const bodyParser = require('body-parser');

const cors = require('cors')({origin: true});
api.use(cors);
api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));

api.post('/login', async (req,res) => {
   let {username,password} = req.body;

   const snapshot = await db.collection("ms_user")
                              .where('username','==', username)
                              .where('password','==', password)
                              .get();

   if(snapshot.empty){
      //jika password dan email salah
      res.json({
         success: false,
         info: 'Email atau password salah'
      });
   }

   const uid = snapshot.docs[0].id;
   snapshot.forEach(doc =>{
        let user = doc.data();
        let {nama,username} = user;

        res.json({
            success: true,
            uid: uid,
            nama: nama,
            username: username
        })
   })
})

api.post('/register', async(req,res) => {
    // const lengthUser = await db.collection("ms_user").get().size;
    let {image,nama,username,password} = req.body;
    data = {
        image: image,
        nama: nama,
        username: username,
        password: password
    }

    const snapshot = await db.collection("ms_user").where('username','==',username).get();
    if(snapshot.empty){
        const reg = await db.collection("ms_user").add(data);

        if (reg) {
            res.json({
                success: true,
                status: 'Berhasil membuat akun'
            })
        }
    }else{
        res.json({
            success: false,
            status: 'Username telah dipakai, coba gunakan username yang lain'
        })
    }
})

api.post('/getTotalScore', async (req,res) => {
    let {uid} = req.body;

    const userRef = db.collection('ms_user').doc(uid);
    const snapshot = await db.collection("tr_soal").where('id_user', '==', userRef).get();

    if(snapshot.empty){
        res.json({
            total_reward: 0
        })
    }else{
        let lengthTRSoal = snapshot.size;
        let ctr = 0;   
        let total_reward = 0;
        snapshot.forEach(doc =>{
            let tr_soal = doc.data();
            let {reward} = tr_soal;
            
            total_reward += reward;
            ctr++;
            if(lengthTRSoal == ctr) res.json({
                total_reward: total_reward
            });
       })
    }
})

api.get('/getKategori', async (req,res) =>{
    const snapshotKategori = await db.collection("ms_kategori").get();
    let kirim = [];
    let lengthKategori = snapshotKategori.size;
    let ctr = 0;    
    snapshotKategori.forEach(async doc =>{
        let hasil = doc.data();
        const kategoriRef = db.collection('ms_kategori').doc(doc.id);
        const snapshotSoal = await db.collection("ms_soal").where('id_kategori','==', kategoriRef).get();
        let lengthSoal = snapshotSoal.size;
        kirim.push({
            nama_kategori: hasil.nama,
            jumlah_soal: lengthSoal,
            kategori_id: doc.id
        })
        ctr++;
        if(lengthKategori == ctr) res.json(kirim);
    })
})

exports.api = functions.https.onRequest(api);