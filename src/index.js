import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import joi from 'joi';
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

const userSchema = joi.object({
    name: joi.string()
        .empty(" ")
        .required()
});

const getData = async (collection) => {
    const data = await db.collection(collection).find().toArray();
    return data;
}

const userInParticipants = async (name) => {
    const participants = await getData('participants');
    return participants.some(participant => (participant.name === name))
}

app.post('/participants', async (req, res) => {
        const { name } = req.body;
        const validation = userSchema.validate({ name }, { abortEarly: false });

        if (validation.error) {
            const error = validation.error.details.map(error => error.message);
            res.status(422).send(error);
        }

        if (await userInParticipants(name)) {
            res.status(409).send({ message: 'Usuário já cadastrado.' });
            return;
        }
    
    try {

        // await db.collection('participants').insertOne({
        //     name,
        //     lastStatus: Date.now()
        // });

        // await db.collection('messages').insertOne({
        //     from: name,
        //     to: 'Todos',
        //     text: 'entra na sala...',
        //     type: 'status',
        //     time: dayjs().format('HH:mm:ss')
        // });

        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/participants', async (req, res) => {
    try {
        const participants = await getData('participants');
        res.send(participants);
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
    
});

app.post('/messages', async (req, res) => {
    try {
        const { to, text, type } = req.body;
        const { user: from } = req.headers;

        if (!to || !text || !type || (type !== 'message' && type !== 'private_message') || !userInParticipants(from)) {
            res.status(422).send({ message: 'Não foi possível enviar a mensagem.' });
            return;
        }

        await db.collection('messages').insertOne({
            from,
            to,
            text,
            type,
            time: dayjs().format('HH:mm:ss')
        });

        res.sendStatus(201);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/messages', async (req, res) => {
    try {
        const { limit: limitStr } = req.query;
        const { User } = req.headers;
        const messages = await getData('messages');
        const filteredMessages = messages.filter(message => (message.type === 'message' || message.from === User || message.to === User || message.to === 'Todos'));

        if (limitStr) {
            const limit = Number(limitStr);
            const limitedMessages = filteredMessages.slice(-limit);
            res.send(limitedMessages);
            return;
        }

        res.send(filteredMessages);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    try {
        const { user } = req.headers;
        const userSigned = await userInParticipants(user);

        if (!userSigned) {
            res.sendStatus(404);
            return;
        }

        const document = { name: user };
        const newDocument = { $set: { lastStatus: Date.now() } }

        await db.collection('participants').updateOne(document, newDocument, (err, res) => {
            if (err) throw err;
            console.log(`${res.matchedCount} document updated.`);
        });

        res.send('ok');

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

setInterval(async () => {
    const tenSeconds = Date.now() - 10000;
    const query = { lastStatus: { $lt: tenSeconds} };
    
    try {
        const participants = await getData('participants');
        const logouts = participants.filter(participant => (tenSeconds > participant.lastStatus));
    
        logouts.forEach(async (participant) => {
            await db.collection('participants').insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            });
        });
    
        await db.collection('participants').deleteMany(query, (err, res) => {
            if (err) throw err;
            console.log(`${res.deletedCount} documents deleted.`);
        });
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }


}, 15000);

app.listen(5000, () => {
    console.log('Listening on port 5000');
});