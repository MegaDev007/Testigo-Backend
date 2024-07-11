import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import routes from './routes';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cookieParser());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/public', express.static(path.join(__dirname, '../public')));
//app.use('/api/twilio', routes.twilio);
// app.use('/api/users', routes.users);
//app.use('/api/auth', routes.auth);
//app.use('/api/track', routes.track);
// app.use('/api/pool', routes.pool);
app.use('/api/shopify', routes.shopify);

app.use(express.static(path.join(__dirname, '../public/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dist', 'index.html'));
});

app.listen(process.env.PORT, () =>
  console.log(`Example app listening on port ${process.env.PORT}!`),
);
