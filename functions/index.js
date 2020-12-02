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

function compareNamaKategori(a,b){
    const testA = a.nama;
    const testB = b.nama;

    let comparison = 0;
    if (testA > testB) {
        comparison = -1;
    } else if (testA < testB) {
        comparison = 1;
    }
    return comparison;
}

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
        let {nama,username,image} = user;

        res.json({
            success: true,
            uid: uid,
            nama: nama,
            username: username,
            image: image
        })
   })
})

api.post('/editProfile', async (req,res) => {
    let {image,nama,username,newPassword} = req.body;
    let nameChanged = false;
    let imageChanged = false;
    let passwordChanged = false;

    const snapshot = await db.collection("ms_user")
                               .where('username','==', username)
                               .get();
 
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
    if(newPassword && newPassword != '' && newPassword != 'd41d8cd98f00b204e9800998ecf8427e'){
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
                if(lengthKategori == ctr) {
                    kirim.sort(compareNamaKategori);
                    res.json(kirim)
                };
            })
            
        })
    }
})

api.post('/getLeaderboard', async (req,res) =>{
    let {id_saya} = req.body;
    const snapshotUser = await db.collection("ms_user").get();
    let kirim = [];
    let lengthUser = snapshotUser.size;
    let ctr_user = 0;    
    snapshotUser.forEach(async doc =>{
        let uid = doc.id;
        let its_me = false;
        if (id_saya == uid) its_me = true
        let hasil = doc.data();
        const userRef = db.collection('ms_user').doc(uid);
        const snapshot = await db.collection("tr_soal").where('id_user', '==', userRef).get();

        if(snapshot.empty){
            kirim.push({
                nama: hasil.nama,
                total_reward: 0,
                its_me: its_me
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
                        nama: hasil.nama,
                        total_reward: total_reward,
                        its_me: its_me
                    })
                }
           })
        }
        ctr_user++;
        kirim.sort(compare);
        if(lengthUser == ctr_user) res.json(kirim);
    })
})

api.get('/injectSoalBajuAdat', async (req,res) =>{
    let id_kategori_bajuAdat = '6mW9g3kpxcpcJaiH2kky'
    let id_kategori_pahlawan = 'EvldBozE7hm7tIxkyqvX'
    let id_kategori_wayang = 'X6SG5ehEPo6NTUVN7nCa'
    let id_kategori_bangunanIkonik = 'nidMry9oVqecm7lnwtab'

    await db.collection('ms_kategori').doc(id_kategori_bajuAdat).set({
        nama: 'Mengenal Baju Adat'
    })

    await db.collection('ms_kategori').doc(id_kategori_pahlawan).set({
        nama: 'Mengenal Pahlawan'
    })

    await db.collection('ms_kategori').doc(id_kategori_wayang).set({
        nama: 'Mengenal Tokoh Wayang'
    })

    await db.collection('ms_kategori').doc(id_kategori_bangunanIkonik).set({
        nama: 'Mengenal Bangunan Ikonik'
    })

    const kategoriRef = db.collection('ms_kategori').doc(id_kategori_bajuAdat);
    const kategoriRefPahlawan = db.collection('ms_kategori').doc(id_kategori_pahlawan);
    const kategoriRefWayang = db.collection('ms_kategori').doc(id_kategori_wayang);
    const kategoriRefbangunanIkonik = db.collection('ms_kategori').doc(id_kategori_bangunanIkonik);


    const soal = db.collection("ms_soal");

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/372x371/b1eaec77965f7ee42827220d591bb66e/Betawi.png',
        jawabanBenar: 'DKI Jakarta',
        ordering: 1,
        pilihan: ['NTT', 'Jawa Tengah', 'DKI Jakarta', 'Bali'],
        reward: 100,
        soal: 'Baju  adat dari provinsi manakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/369x369/863edfd9177aa908aa45663b5e13824d/Bali.png',
        jawabanBenar: 'Bali',
        ordering: 2,
        pilihan: ['Jawa', 'Dayak', 'Bali', 'Betawi'],
        reward: 100,
        soal: 'Baju  adat milik suku apakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/375x375/1d4666c17a101b63bea212a599a019c4/Dayak.png',
        jawabanBenar: 'Dayak',
        ordering: 3,
        pilihan: ['Dayak', 'Madura', 'Sunda', 'Betawi'],
        reward: 100,
        soal: 'Baju  adat milik suku apakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/370x371/bb604f8476bc7f19a9e986e1090b801f/Nusa_Tenggara_Timur.png',
        jawabanBenar: 'NTT',
        ordering: 4,
        pilihan: ['NTT', 'Jawa Tengah', 'Jawa Timur', 'Aceh'],
        reward: 100,
        soal: 'Baju  adat dari provinsi manakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/371x371/48214f37d6435d02f44d1bacc3f76560/Yogyakarta.png',
        jawabanBenar: 'Yogyakarta',
        ordering: 5,
        pilihan: ['NTT', 'Jawa Tengah', 'DKI Jakarta', 'Yogyakarta'],
        reward: 100,
        soal: 'Baju  adat dari provinsi manakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/370x368/69cf874aa1396d4522e6c413125446f6/Jawa.png',
        jawabanBenar: 'Jawa',
        ordering: 6,
        pilihan: ['Jawa', 'Madura', 'Sunda', 'Bugis'],
        reward: 100,
        soal: 'Baju  adat milik suku apakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67ce924ba226f0cda4f8/371x372/973fc09946562e251ae42ac81a05148b/Madura.png',
        jawabanBenar: 'Madura',
        ordering: 7,
        pilihan: ['Sunda', 'Madura', 'Minahasa', 'Asmat'],
        reward: 100,
        soal: 'Baju  adat milik suku apakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRefWayang,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/262x320/f8885997caed308e18225c3a59bcb67b/Yudhistira.png',
        jawabanBenar: 'Yudhistira',
        ordering: 1,
        pilihan: ['Bima', 'Sadewa', 'Yudhistira', 'Arjuna'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan anak tertua dari Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRefWayang,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/291x339/47fcc4c3d46b33c6de280ad1491e1304/Bima.png',
        jawabanBenar: 'Bima',
        ordering: 2,
        pilihan: ['Bima', 'Sadewa', 'Yudhistira', 'Arjuna'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan yang terkuat dari semua Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRefWayang,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/229x353/d5f39c4a56d1d9529e3194fbb14cbfdb/Sadewa.png',
        jawabanBenar: 'Sadewa',
        ordering: 3,
        pilihan: ['Gareng', 'Petruk', 'Arjuna', 'Sadewa'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan anak bungsu dari Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRefWayang,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/308x352/13a1d33dadfbb1fb25a25efed42f1410/Arjuna.png',
        jawabanBenar: 'Arjuna',
        ordering: 4,
        pilihan: ['Arjuna', 'Puntadewa', 'Werkudara', 'Nakula'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan yang tertampan di antara semua Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRefWayang,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/265x345/ace6f3e4abb31c129c81aca3fc9885bc/Nakula.png',
        jawabanBenar: 'Nakula',
        ordering: 5,
        pilihan: ['Arjuna', 'Nakula', 'Bima', 'Yudhistira'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan saudara kembar dari Sadewa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRefbangunanIkonik,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e68b435feb51e7340944c/290x289/454af8b73676fd15ffea95f110f0055a/Padang.png',
        jawabanBenar: 'Jam Gadang',
        ordering: 1,
        pilihan: ['Jam Gadang', 'Rumah Gadang', 'Joglo', 'Tugu Muda'],
        reward: 100,
        soal: 'Apakah nama bangunan di atas?'
    })

    await soal.add({
        id_kategori: kategoriRefbangunanIkonik,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e68b435feb51e7340944c/311x277/1d166a0c67313d81ffb7bed227959e38/Surabaya.png',
        jawabanBenar: 'Surabaya',
        ordering: 2,
        pilihan: ['Semarang', 'Yogyakarta', 'Surabaya', 'Jakarta'],
        reward: 100,
        soal: 'Bangunan ikonik dari kota manakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRefbangunanIkonik,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e68b435feb51e7340944c/279x287/886fd98086686b13795252cff10e8309/Manokwari.png',
        jawabanBenar: 'Manokwari',
        ordering: 3,
        pilihan: ['Jambi', 'Manokwari', 'Aceh', 'Surabaya'],
        reward: 100,
        soal: 'Bangunan ikonik dari kota manakah gambar di atas?'
    })

    await soal.add({
        id_kategori: kategoriRefPahlawan,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67c9c6cfc05ac43014a9/370x370/99e639ee7fc7ac2e80232ed198143c51/Ki_Hajar_Dewantara.png',
        jawabanBenar: 'Ki Hajar Dewantara',
        ordering: 1,
        pilihan: ['Soetomo', 'Soekarno', 'Ki Hajar Dewantara', 'Muh. Yamin'],
        reward: 100,
        soal: 'Tokoh di atas merupakan tokoh di balik hari pendidikan nasional. Siapakah beliau?'
    })

    await soal.add({
        id_kategori: kategoriRefPahlawan,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67c9c6cfc05ac43014a9/370x370/b98190ebc52b10dac5602702203642b6/Sokarno.png',
        jawabanBenar: 'Soekarno',
        ordering: 2,
        pilihan: ['Soekarno', 'Soetomo', 'WR Supratman', 'Soeharto'],
        reward: 100,
        soal: 'Tokoh di atas merupakan "Bapak Proklamasi" Indonesia, siapakah beliau?'
    })

    await soal.add({
        id_kategori: kategoriRefPahlawan,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67c9c6cfc05ac43014a9/370x370/12be1693edbb13089328615980f9784e/Kartini.png',
        jawabanBenar: 'Kartini',
        ordering: 3,
        pilihan: ['Fatmawati', 'Kartini', 'Megawati', 'Dewi Sartika'],
        reward: 100,
        soal: 'Tokoh di atas mempelopori gerakan emansipasi wanita, siapakah beliau?'
    })

    await soal.add({
        id_kategori: kategoriRefPahlawan,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67c9c6cfc05ac43014a9/370x370/276bd4aac334f8cdf6c4b23901b2b161/Moh_Yamin.png',
        jawabanBenar: 'Muh. Yamin',
        ordering: 4,
        pilihan: ['Muh. Hatta', 'Bung Tomo', 'Muh. Yamin', 'Soekarno'],
        reward: 100,
        soal: 'Tokoh di atas merupakan "Bapak Soneta" Indonesia, siapakah beliau?'
    })

    await soal.add({
        id_kategori: kategoriRefPahlawan,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e67c9c6cfc05ac43014a9/370x370/1bb6c8a671f9d766a8952560b5ee0d69/Bung_Tomo.png',
        jawabanBenar: 'Bung Tomo',
        ordering: 5,
        pilihan: ['Bung Tomo', 'Bung Hatta', 'Soedirman', 'Sutan Syahrir'],
        reward: 100,
        soal: 'Tokoh di atas terkenal dengan jargon "Merdeka atau Mati". Siapakah beliau?'
    })

    res.send('masuk pak')
})

api.get('/injectSoalWayang', async (req,res) =>{
    let id_kategori_wayang = 'X6SG5ehEPo6NTUVN7nCa'

    // await db.collection('ms_kategori').doc(id_kategori_bajuAdat).set({
    //     nama: 'Baju Adat'
    // })

    // await db.collection('ms_kategori').doc(id_kategori_pahlawan).set({
    //     nama: 'Pahlawan'
    // })

    // await db.collection('ms_kategori').doc(id_kategori_wayang).set({
    //     nama: 'Tokoh Wayang'
    // })

    // await db.collection('ms_kategori').doc(id_kategori_bangunanIkonik).set({
    //     nama: 'Bangunan Ikonik'
    // })

    const kategoriRef = db.collection('ms_kategori').doc(id_kategori_wayang);
    const pahlawanRef = db.collection('ms_kategori').doc(id_kategori_pahlawan);
    const bajuAdatRef = db.collection('ms_kategori').doc(id_kategori_bajuAdat);
    const bangunanIkonikRef = db.collection('ms_kategori').doc(id_kategori_bangunanIkonik);

    const soal = db.collection("ms_soal");

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/262x320/f8885997caed308e18225c3a59bcb67b/Yudhistira.png',
        jawabanBenar: 'Yudhistira',
        ordering: 1,
        pilihan: ['Bima', 'Sadewa', 'Yudhistira', 'Arjuna'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan anak tertua dari Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/291x339/47fcc4c3d46b33c6de280ad1491e1304/Bima.png',
        jawabanBenar: 'Bima',
        ordering: 2,
        pilihan: ['Bima', 'Sadewa', 'Yudhistira', 'Arjuna'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan yang terkuat dari semua Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/229x353/d5f39c4a56d1d9529e3194fbb14cbfdb/Sadewa.png',
        jawabanBenar: 'Sadewa',
        ordering: 3,
        pilihan: ['Gareng', 'Petruk', 'Arjuna', 'Sadewa'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan anak bungsu dari Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/308x352/13a1d33dadfbb1fb25a25efed42f1410/Arjuna.png',
        jawabanBenar: 'Arjuna',
        ordering: 4,
        pilihan: ['Arjuna', 'Puntadewa', 'Werkudara', 'Nakula'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan yang tertampan di antara semua Pandawa, siapakah dia?'
    })

    await soal.add({
        id_kategori: kategoriRef,
        image_soal: 'https://trello-attachments.s3.amazonaws.com/5f9e6d095f8e9f6b6605392b/265x345/ace6f3e4abb31c129c81aca3fc9885bc/Nakula.png',
        jawabanBenar: 'Nakula',
        ordering: 5,
        pilihan: ['Arjuna', 'Nakula', 'Bima', 'Yudhistira'],
        reward: 100,
        soal: 'Tokoh wayang di atas merupakan saudara kembar dari Sadewa, siapakah dia?'
    })

    res.send('masuk pak')
})

const runtimeOpts = {
    timeoutSeconds: 60,
    memory: '1GB'
}
exports.api = functions.runWith(runtimeOpts).https.onRequest(api);