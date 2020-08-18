import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongo from "mongodb"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import connect from "./db"
import auth from "./auth"

dotenv.config()

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.listen(port)

app.post('/users/login', async (req, res) => {
    try {
        let db = await connect()
        let user = await db.collection("users").findOne({ username: req.body.username })
        if (user == null || !(await bcrypt.compare(req.body.password, user.password)))
            return res.status(400).send("Credentials are wrong!")
        delete user.password
        let token = jwt.sign(user, process.env.JWT_SECRET, {
            algorithm: 'HS512',
            expiresIn: '1 day',
        })
        res.json({token: token, user: user})
    } catch {
        res.sendStatus(400)
    }
})

app.put('/users/signup', async (req, res) => {
    try {
        if (req.body.password.length < 6) return res.status(400).send("Password is too short!")
        if (req.body.username.length < 4) return res.status(400).send("Username is too short!")
        let db = await connect()
        let test = await db.collection("users").findOne({ username: new RegExp(req.body.username, "i") })
        if (test != null) return res.status(400).send("Username is taken!")
        req.body.password = await bcrypt.hash(req.body.password, 8)
        let result = await db.collection("users").insertOne(req.body)
        if (result.insertedCount == 1) {
            res.sendStatus(200)
        }
        else res.sendStatus(400)
    } catch {
        res.sendStatus(400)
    }
})

app.patch('/users/password', [auth], async (req, res) => {
    try {
        if (req.body.newPassword.length < 6) return res.status(400).send("Password is too short!")
        let db = await connect()
        let user = await db.collection("users").findOne({ _id: mongo.ObjectId(req.body.id) })
        if (!(await bcrypt.compare(req.body.oldPassword, user.password)))
            return res.status(400).send("Incorrect password!")
        let result = await db.collection("users").updateOne(
            { _id: mongo.ObjectId(req.body.id) },
            { $set: { password: await bcrypt.hash(req.body.newPassword, 8) } }
        )
        if (result.modifiedCount == 1) res.sendStatus(200)
        else res.sendStatus(400)
    } catch {
        res.sendStatus(400)
    }
})

app.patch('/users/info', [auth], async (req, res) => {
    try {
        let id = req.body._id
        delete req.body._id
        delete req.body.username
        delete req.body.password
        let db = await connect()
        let result = await db.collection("users").updateOne(
            { _id: mongo.ObjectId(id) },
            { $set: req.body }
        )
        if (result.modifiedCount == 1) res.sendStatus(200)
        else res.sendStatus(400)
    } catch {
        res.sendStatus(400)
    }
})

app.post('/exercises', [auth], async (req, res) => {
    try {
        let db = await connect()
        let cursor = await db.collection("exercises").find({ 
            $or: [
                { owner: req.body.id },
                { public: true }
            ]
        }).project({ owner: 0 }).sort({ name: 1 })
        let result = await cursor.toArray()
        cursor.close()
        if (result.length > 0) res.json(result)
        else res.sendStatus(400)
    }
    catch {
        res.sendStatus(400)
    }
})

app.put('/exercises/save', [auth], async (req, res) => {
    try {
        let db = await connect()
        let result = await db.collection("exercises").insertOne(req.body)
        if (result.insertedCount == 1) res.json(result.insertedId)
        else res.sendStatus(400)
    }
    catch {
        res.sendStatus(400)
    }
})

app.patch('/exercises/delete', [auth], async (req, res) => {
    try {
        let db = await connect()
        let result = await db.collection("exercises").deleteOne({ _id: mongo.ObjectId(req.body.id), owner: req.body.owner })
        if (result.deletedCount == 1) res.sendStatus(200)
        else res.sendStatus(400)
    }
    catch {
        res.sendStatus(400)
    }
})

app.post('/workouts', [auth], async (req, res) => {
    try {
        let db = await connect()
        let cursor = await db.collection("exercises").find({ owner: req.body.id }).project({ owner: 0 }).sort({ date: -1 })
        let result = await cursor.toArray()
        cursor.close()
        if (result.length > 0) res.json(result)
        else res.sendStatus(400)
    }
    catch {
        res.sendStatus(400)
    }
})