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
    } catch (error) {
        console.log(error);
    }
})();

const getParticipants = async () => {
    const participants = await db.collection('participants').find().toArray();
    return participants;
}

const duplicatedUsername = async (name) => {
    const participants = await getParticipants();
    return participants.some(participant => (participant.name === name))
}

app.post('/participants', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            res.status(422).send({ message: 'Todos os campos são obrigatórios' });
            return; //AHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH JOI
        }

        const participants = await getParticipants();

        if (await duplicatedUsername(name)) {
            res.status(409).send({ message: 'Usuário inválido' });
            return;
        }

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
});

app.get('/participants', async (req, res) => {
    try {
        const participants = await getParticipants();
        res.send(participants);
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
    
});

app.listen(5000, () => {
    console.log('Listening on port 5000');
});