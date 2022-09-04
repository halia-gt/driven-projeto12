import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import joi from 'joi';
import { MongoClient, ObjectId } from 'mongodb';
import dayjs from 'dayjs';
import { stripHtml } from 'string-strip-html';

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
        .empty(' ')
        .min(3)
        .required()
});

const messageSchema = joi.object({
    to: joi.string()
        .empty(' ')
        .required(),
    text: joi.string()
        .empty(' ')
        .required(),
    type: joi.valid('message', 'private_message')
        .required()
});

const getData = async (collection, query = {}) => {
    const data = await db.collection(collection).find(query).toArray();
    return data;
}

const userInParticipants = async (name) => {
    const participant = await db.collection('participants').findOne({ name: name });
    return participant;
}

const sanitize = (string) => {
    if (!string) return;
    const sanitized = stripHtml(string, { trimOnlySpaces: true }).result;
    return sanitized;
}

app.post('/participants', async (req, res) => {
        const { name: unName } = req.body;
        const name = sanitize(unName);

        const validation = userSchema.validate({ name }, { abortEarly: false });

        if (validation.error) {
            const errors = validation.error.details.map(error => error.message);
            res.status(422).send({ message: errors });
            return;
        }
    
    try {
        if (await userInParticipants(name)) {
            res.status(409).send({ message: 'Usuário já cadastrado.' });
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
        const participants = await getData('participants');
        res.send(participants);
        
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/messages', async (req, res) => {
    const { to: unTo, text: unText, type: unType } = req.body;
    const { user } = req.headers;
    const to = sanitize(unTo);
    const text = sanitize(unText);
    const type = sanitize(unType);
    const from = sanitize(user);
    console.log({
        from,
        type,
        text,
        to
    })

    const validation = messageSchema.validate({ to, text, type }, { abortEarly: false });

    try {
        const validTo = (to === 'Todos') || await userInParticipants(to);

        if (validation.error || !(await userInParticipants(from)) || !validTo) {
            const errors = validation.error ? validation.error.details.map(error => error.message) : 'Usuário inválido';
            res.status(422).send({ message: errors });
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
    const { limit: limitStr } = req.query;
    const { user: unUser } = req.headers;
    const limit = sanitize(limitStr);
    const user = sanitize(unUser);

    const query = {
        $or: [
            {type: 'message'},
            {from: user},
            {to: user},
            {to: 'Todos'}
        ]
    };

    try {
        if (!user || !(await userInParticipants(user))) {
            res.status(400).send({ message: 'Usuário inválido'});
            return;
        }

        if (limit) {
            const limitNum = Number(limitStr);
            const messages = (await db.collection('messages').find(query).sort({_id: -1}).limit(limitNum).toArray()).reverse();

            res.send(messages);
            return;
        }

        const messages = (await getData('messages', query)).reverse();
        res.send(messages);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.delete('/messages/:messageId', async (req, res) => {
    const { messageId: unMessageId } = req.params;
    const { user: unUser } = req.headers;
    const messageId = sanitize(unMessageId);
    const user = sanitize(unUser);
    const query = { _id: new ObjectId(messageId) };

    try {
        const message = (await getData('messages', query))[0];

        if (!message) {
            res.status(404).send({ message: 'Mensagem não encontrada' });
            return;
        }

        if (message.from !== user) {
            res.status(401).send({ message: 'Sem autorização para deletar' });
            return;
        }

        await db.collection('messages').deleteOne(query);
        res.sendStatus(200);     

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.put('/messages/:messageId', async (req, res) => {
    const { messageId: unMessageId } = req.params;
    const { to: unTo, text: unText, type: unType } = req.body;
    const { user } = req.headers;
    const messageId = sanitize(unMessageId);
    const to = sanitize(unTo);
    const text = sanitize(unText);
    const type = sanitize(unType);
    const from = sanitize(user);
    const query = { _id: new ObjectId(messageId) };
    const validation = messageSchema.validate({ to, text, type }, { abortEarly: false });
    const newDocument = { $set: {
        from,
        to,
        text,
        type,
        time: dayjs().format('HH:mm:ss')
    }};

    try {
        const validTo = (to === 'Todos') || await userInParticipants(to);
        const message = (await getData('messages', query))[0];
        console.log(message);

        if (validation.error || !(await userInParticipants(from)) || !validTo) {
            const errors = validation.error ? validation.error.details.map(error => error.message) : 'Usuário inválido';
            res.status(422).send({ message: errors });
            return;
        }

        if (!message) {
            res.status(404).send({ message: 'Mensagem não encontrada' });
            return;
        }

        if (message.from !== from) {
            res.status(401).send({ message: 'Sem autorização para modificar' });
            return;
        }

        await db.collection('messages').updateOne(query, newDocument, (err, res) => {
            if (err) throw err;
            console.log(`${res.matchedCount} document updated.`);
        });

        res.sendStatus(200);     

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.post('/status', async (req, res) => {
    const { user: unUser } = req.headers;
    const user = sanitize(unUser);
    
    try {
        if (!(await userInParticipants(user))) {
            res.sendStatus(404);
            return;
        }

        const document = { name: user };
        const newDocument = { $set: { lastStatus: Date.now() } };

        await db.collection('participants').updateOne(document, newDocument);

        res.sendStatus(200);

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

setInterval(async () => {
    const tenSecondsAgo = Date.now() - 10000;
    const query = { lastStatus: { $lt: tenSecondsAgo} };
    
    try {
        const participants = await getData('participants');
        const logouts = participants.filter(participant => (participant.lastStatus < tenSecondsAgo));
    
        await db.collection('participants').deleteMany(query, (err, res) => {
            if (err) throw err;
            console.log(`${res.deletedCount} documents deleted.`);
        });

        logouts.forEach(async (participant) => {
            await db.collection('messages').insertOne({
                from: participant.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            });
        });

    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
}, 15000);

app.listen(5000, () => {
    console.log('Listening on port 5000');
});