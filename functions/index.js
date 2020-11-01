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
            nama: nama,
            username: username
        })
   })
})

exports.api = functions.https.onRequest(api);