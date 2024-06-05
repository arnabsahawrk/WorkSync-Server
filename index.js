const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

//config
require("dotenv").config();
const port = process.env.PORT || 8080;
const app = express();

//middleware
app.use(cors());
app.use(express.json());

//custom middleware
//token verifying middleware
const verifyToken = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_KEY, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }

    req.decoded = decoded;
    next();
  });
};

//Database Authenticate
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2p5zaxk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//Send and Get data from sever to database
async function run() {
  try {
    //All Database Collection
    const DB = client.db("WorkSync");
    const staffsCollection = DB.collection("staffs");
    const tasksCollection = DB.collection("tasks");

    //User Authentication Related API (JWT)
    //jwt token setup
    app.post("/jwt", (req, res) => {
      const staff = req.body;
      const token = jwt.sign(staff, process.env.ACCESS_TOKEN_KEY, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //Admin Related API
    //admin token verifying middleware
    const verifyAdmin = async (req, res, next) => {
      const uid = req.decoded.uid;
      const result = await staffsCollection.findOne({ uid: uid });

      if (!result || result?.role !== "Admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      next();
    };

    //HR Related API
    //hr token verifying middleware
    const verifyHR = async (req, res, next) => {
      const uid = req.decoded.uid;
      const result = await staffsCollection.findOne({ uid: uid });

      if (!result || result?.role !== "HR") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      next();
    };

    //Employee Related API
    //save new user data in database
    app.put("/staff", async (req, res) => {
      const staff = req.body;
      const query = { uid: staff?.uid };

      //isExist already exist
      const isExist = await staffsCollection.findOne(query);
      if (isExist) {
        //if the user exist and want to update the existing user data
        if (staff.update) {
          const updateDoc = {
            $set: {
              ...staff,
            },
          };

          const result = await staffsCollection.updateOne(query, updateDoc);

          return res.send({ message: "update staff data", result });
        } else {
          return res.send({ message: "user already exist" });
        }
      }

      //save new user
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...staff,
        },
      };
      const result = await staffsCollection.updateOne(
        query,
        updateDoc,
        options
      );
      res.send({ message: "saved new user data", result });
    });

    //get single staff data
    app.get("/staff", verifyToken, async (req, res) => {
      const uid = req.query.uid;

      if (req.decoded.uid !== uid) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = await staffsCollection.findOne({ uid: uid });

      res.send(result);
    });

    //post work task
    app.post("/task", verifyToken, async (req, res) => {
      const taskData = req.body;

      if (req.decoded.uid !== taskData.uid) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = await tasksCollection.insertOne(taskData);

      res.send(result);
    });

    //get tasks by uid
    app.get("/tasks", verifyToken, async (req, res) => {
      const uid = req.query.uid;

      if (req.decoded.uid !== uid) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = (
        await tasksCollection.find({ uid: uid }).toArray()
      ).reverse();

      res.send(result);
    });
  } catch (err) {
    console.log("Error from database:", err);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Server is running on ${port}`);
});

app.listen(port, () => {
  console.log(`Server connected on ${port}`);
});
