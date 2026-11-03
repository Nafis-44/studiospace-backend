import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import cors from 'cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const app = express();
const port = 8000;


app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

const mongoClient = await connectToMongoDB();
const db = mongoClient.db('studiospace');
const studioCollection = db.collection('studios');
const bookingCollection = db.collection('bookings');

const verifyApi = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ error: "Unauthorized" });
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).send({ error: "Unauthorized" });
  }

  const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  try {
    const { payload } = await jwtVerify(token, JWKS);

    next();
  } catch (error) {
    return res.status(500).send({ error: "Unauthorized" });
  }
}

app.get('/', (req, res) => {
  res.send({ message: 'Server is running fine!' });
});


app.post('/add-studio',verifyApi, async (req, res) => {
  try {
    const studioData = req.body;
    const result = await studioCollection.insertOne(studioData);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to add studio" });
  }
});


app.get('/studios', async (req, res) => {
  try {
    const result = await studioCollection.find().toArray();
    console.log(result);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch studios" });
  }
});


app.get('/featured-studios', async (req, res) => {
  try {
    const result = await studioCollection.find().limit(6).toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch featured studios" });
  }
});


app.get('/studios/:id', verifyApi, async (req, res) => {

  try {
    const { id } = req.params;
    const studio = await studioCollection.findOne({ _id: new ObjectId(id) });
    res.send(studio);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch studio details" });
  }
});


app.patch('/studios/:id', verifyApi, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        title: updatedData.title,
        category: updatedData.category,
        hourlyRate: updatedData.hourlyRate,
        securityDeposit: updatedData.securityDeposit,
        maxCapacity: updatedData.maxCapacity,
        location: updatedData.location,
        image: updatedData.image,
        amenities: updatedData.amenities,
        description: updatedData.description,
      },
    };
    const result = await studioCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to update studio" });
  }
});

// 5. DELETE STUDIO API
app.delete('/studios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await studioCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to delete studio" });
  }
});


// ==================== BOOKINGS API ROUTES ====================

// A. POST /bookings - Save new studio booking (WITH DOUBLE-BOOKING PREVENTION)
app.post('/bookings', async (req, res) => {
  try {
    const bookingData = req.body;

    // Challenge 2: Duplicate / Overlap booking prevention check
    const existingBooking = await bookingCollection.findOne({
      studioId: bookingData.studioId,
      date: bookingData.date,
      status: "Confirmed"
    });

    // Same studio ebong same date-e "Confirmed" booking paoya gele request cancel kora hobe
    if (existingBooking) {
      return res.status(400).send({
        error: "This studio is already booked and confirmed for this date!"
      });
    }

    // Default status "Pending" set kore save kora
    const newBooking = {
      ...bookingData,
      status: "Pending",
      createdAt: new Date()
    };

    const result = await bookingCollection.insertOne(newBooking);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to create booking" });
  }
});

// B. GET /bookings - Fetch all user bookings
app.get('/bookings', async (req, res) => {
  try {
    const result = await bookingCollection.find().toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch bookings" });
  }
});

// C. PATCH /bookings/:id/cancel - Cancel a booking
app.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { status: "Cancelled" }
    };
    const result = await bookingCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to cancel booking" });
  }
});

// ============================================================

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;