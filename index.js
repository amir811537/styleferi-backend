require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: ["http://localhost:5173" ,"https://styleferibd.vercel.app/"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB setup
const uri = "mongodb+srv://amirhossainbc75:FawNlCNrdHtAseoZ@cluster0.ps5uh.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

// ------------------- Admin verification middleware -------------------
const verifyAdmin = async (req, res, next) => {
  const email = req.body.email || req.query.email;
  if (!email) return res.status(400).send({ message: "Email is required for admin verification" });

  const db = client.db("UsersDB");
  const usersCollection = db.collection("users");
  const user = await usersCollection.findOne({ email });

  if (!user || user.role !== "admin") return res.status(403).send({ message: "Forbidden: Admin only" });
  next();
};

// ------------------- Connect to MongoDB and define routes -------------------
async function run() {
  try {
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected!");

    const db = client.db("UsersDB");
    const usersCollection = db.collection("users");
    const categoryCollection = db.collection("categoryCollection");
    const productsCollection = db.collection("productsCollection");
    const wishListCollection = db.collection("wishListCollection");
    const cartCollection = db.collection("cartCollection");
    const ordersCollection = db.collection("ordersCollection");
    const flashSaleCollection = db.collection("FlashSaleCollection");
    const couponCollection = db.collection("couponCollection");

    // ------------------- User Routes -------------------
    app.post("/users", async (req, res) => {
      const user = req.body;
      const existingUser = await usersCollection.findOne({ email: user.email });
      if (existingUser) return res.status(400).send({ message: "User already exists" });
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/user/:email", async (req, res) => {
      const result = await usersCollection.findOne({ email: req.params.email });
      res.send(result);
    });

    app.put("/users/update", async (req, res) => {
      const { email, ...updateData } = req.body;
      const result = await usersCollection.updateOne({ email }, { $set: updateData });
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const { customer } = req.query;
      let query = {};
      if (customer) query.customer = true;
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });

    // Only this route needs admin verification
    app.put("/users/role", verifyAdmin, async (req, res) => {
      const { email } = req.body;
      const result = await usersCollection.updateOne({ email }, { $set: { role: "admin" } });
      res.send(result);
    });

    // ------------------- Category Routes -------------------
    app.get("/categories", async (req, res) => {
      const result = await categoryCollection.find().toArray();
      res.send(result);
    });

    app.post("/categories", async (req, res) => {
      const result = await categoryCollection.insertOne(req.body);
      res.send(result);
    });

    app.delete("/categories/:id", async (req, res) => {
      const result = await categoryCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // ------------------- Products Routes -------------------
    app.get("/products", async (req, res) => {
      const { limit = 30, sortBy, sortOrder, categories, minPrice, maxPrice, searchText, page = 0 } = req.query;
      const query = {};

      if (categories) query.category = { $in: categories.split(",") };
      if (minPrice || maxPrice) query.price = {};
      if (minPrice) query.price.$gte = parseInt(minPrice);
      if (maxPrice) query.price.$lte = parseInt(maxPrice);
      if (searchText) query.$or = [
        { title: new RegExp(searchText, "i") },
        { description: new RegExp(searchText, "i") },
        { category: new RegExp(searchText, "i") },
        { price: parseInt(searchText) || 0 }
      ];

      let cursor = productsCollection.find(query);
      if (sortBy) cursor = cursor.sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 });
      cursor = cursor.skip(page * limit).limit(parseInt(limit));

      const result = await cursor.toArray();
      res.json(result);
    });

    app.post("/products", async (req, res) => {
      const result = await productsCollection.insertOne(req.body);
      res.send(result);
    });

    app.put("/products/update/:id", async (req, res) => {
      const result = await productsCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: req.body }
      );
      res.send(result);
    });

    app.get("/products/:id", async (req, res) => {
      const result = await productsCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.delete("/products/:id", async (req, res) => {
      const result = await productsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result.deletedCount ? { success: true } : { success: false, message: "Product not found" });
    });

    // ------------------- Wishlist Routes -------------------
    app.post("/wishlist", async (req, res) => {
      const product = req.body;
      const exists = await wishListCollection.findOne({ productId: product.productId, email: product.email });
      if (exists) return res.status(409).send({ message: "Product already in wishlist" });
      const result = await wishListCollection.insertOne(product);
      res.send(result);
    });

    app.get("/wishlist", async (req, res) => {
      const email = req.query.email;
      const result = await wishListCollection.find({ email }).toArray();
      res.send(result);
    });

    app.delete("/wishlist/:id", async (req, res) => {
      const result = await wishListCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // ------------------- Cart Routes -------------------
    app.post("/cart", async (req, res) => {
      const item = req.body;
      const exists = await cartCollection.findOne({ productId: item.productId, email: item.email });
      if (exists) return res.status(409).send({ message: "Product already in cart" });
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const result = await cartCollection.find({ email }).toArray();
      res.send(result);
    });

    app.put("/cart/:id", async (req, res) => {
      const { quantity } = req.body;
      const result = await cartCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { quantity } });
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const result = await cartCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.delete("/allCartItem", async (req, res) => {
      const result = await cartCollection.deleteMany({});
      res.send(result);
    });

    // ------------------- Orders Routes -------------------
    app.post("/orders", async (req, res) => {
      const result = await ordersCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/orders", async (req, res) => {
      const email = req.query.email;
      const result = await ordersCollection.find({ "customerDetail.email": email, status: { $in: ["pending", "completed"] } }).sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.put("/order/update/:id", async (req, res) => {
      const { status } = req.body;
      const result = await ordersCollection.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status } });
      res.send(result);
    });

    app.get("/cancelledOrder", async (req, res) => {
      const email = req.query.email;
      const result = await ordersCollection.find({ "customerDetail.email": email, status: "cancelled" }).sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.get("/allOrders", async (req, res) => {
      const result = await ordersCollection.find().sort({ date: -1 }).toArray();
      res.send(result);
    });

    app.get("/singleOrders/:id", async (req, res) => {
      const result = await ordersCollection.findOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    // ------------------- FlashSale Routes -------------------
    app.post("/flashSale", async (req, res) => {
      const { startTime, endTime, products, discount } = req.body;
      const existingFlashSale = await flashSaleCollection.findOne({ $or: [{ startTime: { $lte: endTime }, endTime: { $gte: startTime } }] });
      if (existingFlashSale) return res.status(400).json({ message: 'Overlapping flash sale exists.' });

      const result = await flashSaleCollection.insertOne({ startTime, endTime, products, discount });

      const productIds = products.map(id => new ObjectId(id));
      const productsData = await productsCollection.find({ _id: { $in: productIds } }).toArray();
      await Promise.all(productsData.map(p => productsCollection.updateOne({ _id: p._id }, { $set: { discountedPrice: p.price - (p.price * (discount / 100)) } })));
      res.send(result);
    });

    app.get("/flashSale", async (req, res) => {
      const currentTime = new Date().toISOString();
      const activeFlashSale = await flashSaleCollection.findOne({ startTime: { $lte: currentTime }, endTime: { $gte: currentTime } });
      if (!activeFlashSale) return res.status(404).json({ message: "No active flash sales" });

      const productIds = activeFlashSale.products.map(id => new ObjectId(id));
      const productsData = await productsCollection.find({ _id: { $in: productIds } }).toArray();
      res.json({ ...activeFlashSale, products: productsData });
    });

    // ------------------- Coupon Routes -------------------
    app.post("/coupon", async (req, res) => {
      const result = await couponCollection.insertOne(req.body);
      res.send(result);
    });

    app.get("/coupon", async (req, res) => {
      const result = await couponCollection.find().toArray();
      res.send(result);
    });

    app.delete("/coupon/:id", async (req, res) => {
      const result = await couponCollection.deleteOne({ _id: new ObjectId(req.params.id) });
      res.send(result);
    });

    app.post("/singleCoupon", async (req, res) => {
      const coupon = await couponCollection.findOne({ couponCode: req.body.coupon });
      if (coupon) res.json({ success: true, coupon: coupon.couponCode, discount: coupon.discount });
      else res.json({ success: false, message: "Invalid coupon code" });
    });

    // ------------------- Statistics Route -------------------
    app.get("/statistics", async (req, res) => {
      const totalProducts = await productsCollection.estimatedDocumentCount();
      const totalOrder = await ordersCollection.estimatedDocumentCount();
      const totalUsers = await usersCollection.estimatedDocumentCount();
      const totalCompletedOrder = await ordersCollection.countDocuments({ status: "completed" });
      const cancelledOrders = await ordersCollection.countDocuments({ status: "cancelled" });
      const pendingOrder = await ordersCollection.countDocuments({ status: "pending" });

      const result = await ordersCollection.aggregate([{ $group: { _id: null, totalPrice: { $sum: "$totalPrice" } } }]).toArray();
      const totalOrderPrice = result.length ? result[0].totalPrice : 0;

      const barChart = await categoryCollection.aggregate([
        { $lookup: { from: "productsCollection", localField: "title", foreignField: "category", as: "products" } },
        { $addFields: { totalProducts: { $size: "$products" } } },
        { $project: { _id: 0, category: "$title", totalProducts: 1 } }
      ]).toArray();

      res.json({
        overviewData: { totalUsers, totalOrder, totalCompletedOrder, cancelledOrders, totalProducts, totalOrderPrice, pendingOrder },
        BarChart: barChart
      });
    });

  } finally {
    // Keep MongoDB connection alive
  }
}

run().catch(console.dir);

// Default route
app.get("/", (req, res) => res.send("CRUD is running..."));

// Start server
app.listen(port, () => console.log(`Server running on port ${port}`));