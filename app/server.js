const express=require('express');
const {Client}=require('pg');
const app=express();
const client=new Client({
 host:process.env.DATABASE_HOST,
 port:process.env.DATABASE_PORT,
 user:'postgres',
 password:'password',
 database:'appdb'
});
client.connect().catch(console.error);
app.get('/health',(req,res)=>res.status(500).send("NOT OK"));
app.get('/',async(req,res)=>res.send("Hello"));
app.listen(3000);