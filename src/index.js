import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db;

(async () => {
    try {
        await client.connect();
        db = client.db('batepapo-uol');
        console.log('ok')
    } catch (error) {
        console.log(error);
    }
})();

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body;

        if(!name) {
            res.status(422).send({ message: 'Todos os campos são obrigatórios' }); //AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH JOI
        }

        // fazer verificação se o nome já está sendo usado

        await db.collection('participants').insertOne({
            name,
            lastStatus: Date.now()
        });
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        });

        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
})

app.listen(5000, () => {
    console.log('Listening on port 5000');
})