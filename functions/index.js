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

function compare(a, b) {
    const testA = a.total_reward;
    const testB = b.total_reward;

    let comparison = 0;
    if (testA > testB) {
        comparison = -1;
    } else if (testA < testB) {
        comparison = 1;
    }
    return comparison;
}

function compareOrdering(a, b) {
    const testA = a.ordering;
    const testB = b.ordering;

    let comparison = 0;
    if (testA > testB) {
        comparison = 1;
    } else if (testA < testB) {
        comparison = -1;
    }
    return comparison;
}

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

api.post('/editProfile', async (req,res) => {
    let {image,nama,username,oldPassword,newPassword} = req.body;
    let nameChanged = false;
    let imageChanged = false;
    let passwordChanged = false;

    const snapshot = await db.collection("ms_user")
                               .where('username','==', username)
                               .where('password','==', oldPassword)
                               .get();
    
    if(snapshot.empty){
       //jika password dan email salah
       res.json({
          success: false,
          info: 'password salah'
       });
    }
 
    const uid = snapshot.docs[0].id;
    //  ganti nama
    if(nama && nama != ''){
        const upd = await db.collection('ms_user').doc(uid).update({
            nama: nama
        })
        nameChanged = true;
    }
    //  ganti image
    if(image && image != ''){
        const upd = await db.collection('ms_user').doc(uid).update({
            image: image
        })
        imageChanged = true;
    }
    //  ganti image
    if(newPassword && newPassword != ''){
        const upd = await db.collection('ms_user').doc(uid).update({
            password: newPassword
        })
        passwordChanged = true;
    }

    const newSnapshot = await db.collection("ms_user")
                               .where('username','==', username)
                               .get();

    newSnapshot.forEach(doc =>{
        let user = doc.data();
        
        res.json({
            nameChanged: nameChanged,
            imageChanged: imageChanged,
            passwordChanged: passwordChanged,
            profile: user
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
            const snapshotAfterReg = await db.collection("ms_user")
                                                .where('username','==', username)
                                                .where('password','==', password)
                                                .get();
            
            const uid = snapshotAfterReg.docs[0].id;
            snapshotAfterReg.forEach(doc =>{
                let user = doc.data();
                let {nama,username} = user;
        
                res.json({
                    success: true,
                    uid: uid,
                    nama: nama,
                    username: username,
                    status: 'Berhasil membuat akun'
                })
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
    const ada = await userRef.get();

    if(!ada.exists){
        res.json({
            info: 'id_user tidak ditemukan',
            response: {}
        })
    }else{
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
    }
})

api.post('/jawabSoal', async (req,res) => {
    let {uid,id_soal,jawab} = req.body;
    let info_salah = 'Jawaban kamu salah';
    let info_benar = 'Berhasil kamu menjawab dengan benar';

    const userRef = db.collection("ms_user").doc(uid);
    const ada = await userRef.get();

    if(!ada.exists){
        res.json({
            info: 'id_user tidak ditemukan',
            response: {}
        })
    }else{
        const soalRef = db.collection("ms_soal").doc(id_soal);

        const doc = await soalRef.get();

        if(!doc.exists){
            return res.json({
                status: 'Soal tidak ditemukan',
                response: {}
            })
        }else{
            let hasil = doc.data();
            let penalty = hasil.reward/4;
            let data = {
                id_soal: soalRef,
                id_user: userRef
            }

            if(hasil.jawabanBenar == jawab){
                data.reward = hasil.reward;
                data.is_right = true;

                const snapshotTRSoal = await db.collection('tr_soal').where('id_soal','==',soalRef).where('id_user','==',userRef).get();
                const lengthTRSoal = snapshotTRSoal.size;
                //kalo di tr_soal tidak pernah menjawab maka add new collecltion
                if(lengthTRSoal == 0) {
                    const reg = await db.collection("tr_soal").add(data);

                    if (reg) {
                        res.json({
                            is_right: true,
                            info: info_benar,
                            reward: hasil.reward
                        })
                    }
                }else{
                    const idTRSoal = snapshotTRSoal.docs[0].id;
                    snapshotTRSoal.forEach(async doc => {
                        let hasil = doc.data();

                        //kalo di tr_soal udah is_right tidak perlu update koleksinya
                        if(hasil.is_right){
                            res.json({
                                is_right: true,
                                info: info_benar,
                                reward: hasil.reward,
                                repeated: true
                            })
                        }else{
                            const upd = await db.collection('tr_soal').doc(idTRSoal).update({
                                reward: hasil.reward,
                                is_right: true
                            })
            
                            if(upd) {
                                res.json({
                                    is_right: true,
                                    info: info_benar,
                                    reward: hasil.reward
                                })
                            }
                        }
                    })
                }
            }else{
                data.reward = hasil.reward-penalty;
                data.is_right = false;


                const snapshotTRSoal = await db.collection('tr_soal').where('id_soal','==',soalRef).where('id_user','==',userRef).get();
                const lengthTRSoal = snapshotTRSoal.size;
                //kalo di tr_soal tidak pernah menjawab maka add new collecltion
                if(lengthTRSoal == 0) {
                    const reg = await db.collection("tr_soal").add(data);

                    if (reg) {
                        res.json({
                            is_right: false,
                            info: info_salah
                        })
                    }
                }else{
                    const idTRSoal = snapshotTRSoal.docs[0].id;
                    snapshotTRSoal.forEach(async doc => {
                        let hasil = doc.data();

                        //kalo di tr_soal udah is_right tidak perlu update koleksinya
                        if(hasil.is_right){
                            res.json({
                                is_right: false,
                                info: info_salah
                            })
                        }else{
                            hasil.reward -= penalty;
                            if(hasil.reward < 0) hasil.reward = 0;
                            const upd = await db.collection('tr_soal').doc(idTRSoal).update({
                                reward: hasil.reward,
                            })
            
                            if(upd) {
                                res.json({
                                    is_right: false,
                                    info: info_salah
                                })
                            }
                        }
                    })
                }
            }
        }
    }
})

api.post('/getSoal', async (req,res) => {
    let {id_soal} = req.body;

    const doc = await db.collection("ms_soal").doc(id_soal).get();

    if (!doc.exists) {
        return res.json({
            status: 'Soal tidak ditemukan',
            response: {}
        })
    } else {
        let hasil = doc.data();
        let next_id_soal;
        let prev_id_soal;

        hasil.id_kategori.get().then(async resp => {
            const kategoriRef = db.collection('ms_kategori').doc(resp.id);

            const nextprevSoal = await db.collection("ms_soal").where('id_kategori','==',kategoriRef).where('ordering','in',[hasil.ordering-1,hasil.ordering+1]).get();

            nextprevSoal.forEach(async doc => {
                let nextprev = doc.data();
                if(nextprev.ordering == hasil.ordering-1) prev_id_soal = doc.id;
                if(nextprev.ordering == hasil.ordering+1) next_id_soal = doc.id;
            })

            return res.json({
                image_soal: hasil.image_soal,
                reward: hasil.reward,
                soal: hasil.soal,
                pilihan: hasil.pilihan,
                next: next_id_soal,
                prev: prev_id_soal
            });
        })
    }
})

api.post('/getSoalPerkategori', async (req,res) => {
    let {uid,id_kategori} = req.body;
    let kirim = [];
    
    const userRef = db.collection('ms_user').doc(uid)
    const adaUser = await userRef.get();

    if(!adaUser.exists){
        res.json({
            info: 'id_user tidak ditemukan',
            response: {}
        })
    }else{
        const kategoriRef = db.collection('ms_kategori').doc(id_kategori);
        const adaKategori = await kategoriRef.get();
        if(!adaKategori.exists){
            res.json({
                info: 'id_kategori tidak ditemukan',
                response: {}
            })
        }else{
            let dataKategori = adaKategori.data();
            let nama_kategori = dataKategori.nama;
            const snapshotSoal = await db.collection("ms_soal").where('id_kategori','==', kategoriRef).get();

            let lengthSoal = snapshotSoal.size;
            let ctr = 0;    
            snapshotSoal.forEach(async doc => {
                let hasil = doc.data();
                let id_soal = doc.id;
                let is_done = false;
                let soalRef = db.collection('ms_soal').doc(doc.id);

                const snapshotTRSoal = await db.collection("tr_soal").where('id_user', '==', userRef).where('id_soal','==',soalRef).get();
                if(snapshotTRSoal.empty){
                    kirim.push({
                        judul: 'soal ' + hasil.ordering,
                        id_soal: id_soal,
                        is_done: is_done,
                        ordering: hasil.ordering
                    })
                }else{
                    snapshotTRSoal.forEach(async doc => {
                        let hasilTRSoal = doc.data();
                        is_done = true;
                        kirim.push({
                            judul: 'soal ' + hasil.ordering,
                            id_soal: id_soal,
                            is_done: is_done,
                            is_right: hasilTRSoal.is_right,
                            ordering: hasil.ordering
                        })
                    })
                }
                ctr++;
                kirim.sort(compareOrdering);
                if(lengthSoal == ctr) res.json({
                    nama_kategori: nama_kategori,
                    soal: kirim
                });
            })
        }
    }
})

api.post('/getKategori', async (req,res) =>{
    let {uid} = req.body;

    const userRef = db.collection('ms_user').doc(uid);
    const ada = await userRef.get();

    if(!ada.exists){
        res.json({
            info: 'id_user tidak ditemukan',
            response: {}
        })
    }else{
        const snapshotKategori = await db.collection("ms_kategori").get();
    
        let kirim = [];
        let lengthKategori = snapshotKategori.size;
        let ctr = 0;    
        snapshotKategori.forEach(async doc =>{
            let hasil = doc.data();
            let nama_kategori = hasil.nama;
            let kategori_id = doc.id;
            const kategoriRef = db.collection('ms_kategori').doc(doc.id);
            const snapshotSoal = await db.collection("ms_soal").where('id_kategori','==', kategoriRef).get();

            let lengthSoal = snapshotSoal.size;
            let lengthTRSoal = 0;
            let ctr_soal = 0;    
            
            new Promise(resolve => {
                snapshotSoal.forEach(async doc => {
                    let soalRef = db.collection('ms_soal').doc(doc.id);
        
                    const snapshotTRSoal = await db.collection("tr_soal").where('id_user', '==', userRef).where('id_soal','==',soalRef).get();
                    if(!snapshotTRSoal.empty){
                        snapshotTRSoal.forEach(async doc => {
                            let hasilTRSoal = doc.data();
                            
                            if(hasilTRSoal.is_right) lengthTRSoal++
                        })
                    }
                    ctr_soal++;
                    if(lengthSoal == ctr_soal) {
                        let data = {
                            nama_kategori: nama_kategori,
                            jumlah_soal: lengthSoal,
                            kategori_id: kategori_id,
                            progress: 0
                        }
                        data.progress = lengthTRSoal/lengthSoal;
                        kirim.push(data);
                        resolve();
                    };
                })
            }).then(() => {
                ctr++
                if(lengthKategori == ctr) res.json(kirim);
            })
            
        })
    }
})

api.get('/getLeaderboard', async (req,res) =>{
    const snapshotUser = await db.collection("ms_user").get();
    let kirim = [];
    let lengthUser = snapshotUser.size;
    let ctr_user = 0;    
    snapshotUser.forEach(async doc =>{
        let uid = doc.id;
        let hasil = doc.data();
        const userRef = db.collection('ms_user').doc(uid);
        const snapshot = await db.collection("tr_soal").where('id_user', '==', userRef).get();

        if(snapshot.empty){
            kirim.push({
                username: hasil.nama,
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
                if(lengthTRSoal == ctr) {
                    kirim.push({
                        username: hasil.nama,
                        total_reward: total_reward
                    })
                }
           })
        }
        ctr_user++;
        kirim.sort(compare);
        if(lengthUser == ctr_user) res.json(kirim);
    })
})

const runtimeOpts = {
    timeoutSeconds: 60,
    memory: '2GB'
}
exports.api = functions.runWith(runtimeOpts).https.onRequest(api);