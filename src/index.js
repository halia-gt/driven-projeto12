import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import Joi from 'joi';
import { MongoClient } from 'mongodb';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
