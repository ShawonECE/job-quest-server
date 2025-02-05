const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 3000;
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET);

// middlewares
app.use(cors(
  {
    origin: ['http://localhost:5173', 'https://job-quest-15948.web.app', 'https://job-quest-15948.firebaseapp.com', 'https://job-quest1.netlify.app'],
    credentials: true
  }
));
app.use(express.json());
app.use(cookieParser());

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5yhhqym.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const db = client.db("jobQuest");
const coll = db.collection("jobs");
const collApplication = db.collection("applications");
const collStories = db.collection("stories");
const collPremium = db.collection("premium");

const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log(token);
  if (!token) {
    console.log('No token');
    return res.status(401).send({message: 'unauthorized access'});
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('Invalid token');
      return res.status(401).send({message: 'unauthorized access'});
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // await client.connect();

    app.post('/jwt', async (req, res) => {
      const user = req.body.user;
      const token = jwt.sign({ data: user }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('token', token, cookieOptions).send({success: true});
    });

    app.post('/logout', (req, res) => {
        res.clearCookie('token', { ...cookieOptions, maxAge: 0 }).send({success: true});
    });

    app.get('/', async (req, res) => {
      res.send('Welcome to jobQuest');
    });
    
    app.get('/jobs', async (req, res) => {
        const result = await coll.find().toArray();
        res.send(result);
    });

    app.get('/my-jobs', verifyToken, async (req, res) => {
        const email = req.query.email;
        if (email !== req.user.data) {
            return res.status(403).send({message: 'Forbidden access'});
        }
        let query = { "posted_by.email" : email};
        const result = await coll.find(query).toArray();
        res.send(result);
    });

    app.get('/applications', verifyToken, async (req, res) => {
        const email = req.query?.email;
        if (email !== req.user.data) {
            return res.status(403).send({message: 'Forbidden access'});
        }
        let query = { email : email};
        const result = await collApplication.find(query).toArray();
        res.send(result);
    });

    app.get('/stories', async (req, res) => {
        const result = await collStories.find().toArray();
        res.send(result);
    });

    app.get('/jobs/:id', async (req, res) => {
        const id = new ObjectId(req.params.id);
        const result = await coll.findOne({ _id: id });
        res.send(result);
    });

    app.post('/', async (req, res) => {
        const data = req.body;
        const result = await coll.insertOne(data);
        res.send(result);
    });

    app.post('/application', async (req, res) => {
        const data = req.body;
        const result = await collApplication.insertOne(data);
        if (result.insertedId) {
            const updateJob = {
                $inc: {
                    number_of_applicants: 1,
                },
            };
            const newResult = await coll.updateOne({_id: new ObjectId(req.body.job_id)}, updateJob);
        }
        res.send(result);
    });

    app.delete('/:id', async (req, res) => {
        const id = new ObjectId(req.params.id);
        const result = await coll.deleteOne({_id: id});
        res.send(result);
    });

    app.patch('/:id', async (req, res) => {
        const data = req.body;
        const id = new ObjectId(req.params.id);
        const updateDoc = {
            $set: {
                job_title: data.job_title,
                job_img: data.job_img,
                job_category: data.job_category,
                job_description: data.job_description,
                number_of_applicants: data.number_of_applicants,
                deadline: data.deadline,
                salary_range: data.salary_range
            },
        };
        const result = await coll.updateOne({_id: id}, updateDoc, { upsert: true });
        res.send(result);
    });

    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    }); 

    app.post('/create-premium', async (req, res) => {
      const data = req.body;
      const result = await collPremium.insertOne(data);
      res.send(result);
    });

    app.get('/premium', async (req, res) => {
      const email = req.query.email;
      const result = await collPremium.findOne({ email: email });
      res.send(result);
    });
  } 
  finally {
    
  }
}
run().catch(console.dir);

app.listen(port);