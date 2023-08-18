const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9r1od98.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


async function run() {
    try {

        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const usersCollection = client.db("bloodHelpDb").collection("users");
        const emergencyRequestsCollection = client.db("bloodHelpDb").collection("emergencyRequests");
        const emergencyHelpOffersCollection = client.db("bloodHelpDb").collection("emergencyAppliedRequests");
        const availableUsersForAlertCollection = client.db("bloodHelpDb").collection("availableUsersForAlert");
        availableUsersForAlertCollection.createIndex({ locationData: '2dsphere' });



        /*------------user api---------
            -----------------------------------------------------*/

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            console.log("email", email)
            const query = { email: email }
            const result = await usersCollection.findOne(query);
            // console.log("result", result);
            res.send(result);
        });

        //secure donor routes
        // app.get('/users/all-donors', async (req, res) => {
        //     console.log('hello')

        //     const result = await usersCollection.find({ role: 'donor' }).toArray();
        //     res.send(result);
        // })
        app.get('/alldonors', async (req, res) => {
            const result = await usersCollection.find({ role: 'donor' }).toArray();
            res.send(result);
        })

        // get all emergency requests
        app.get('/all-emergency-requests', async (req, res) => {
            const result = await emergencyRequestsCollection.find().toArray();
            res.send(result);
        })

        // //get my emergency requests. dDUPLICATE
        // app.get('/my-emergency-requests/:email', async (req, res) => {
        //     const email = req.params.email;
        //     console.log(email)
        //     const query = { email: email };
        //     const result = await emergencyRequestsCollection.find(query).toArray();
        //     res.send(result);
        // })

        //get my offered emergency requests
        app.get('/donors/my-offered-emergency-requests/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email: email };
            const result = await emergencyHelpOffersCollection.find(query).toArray();
            res.send(result);
        })

        // get all offered help response email - for added emergency blood posts.
        // That api would check how many responses are available of /:email in emergencyRequestsCollection. that will gives all the responses in an array. 
        app.get('/emergency-req/total-response/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email: email };
            const existedRequest = await emergencyRequestsCollection.find(query).toArray(); // get all
            res.send(existedRequest);
        })


        //get my all posted emergency requests , using email query - OF A SPECIFIC PATIENT
        /** emergencyRequestsCollection contains all the posted request. It stores each posted request in different object. Even though one patient post more than one, each post is stored individually. So it can be 2 or more post has same patient email.
         */
        app.get('/my-emergency-requests/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email: email };
            const result = await emergencyRequestsCollection.find(query).toArray();
            res.send(result);
        })


        // get all information of specific offered response email 
        app.get('/emergency-requests/each-response/all-information/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email)
            const query = { email: email };
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })

        // get my offered help for posted requests. 
        app.get('/offered-help/:email', async (req, res) => {
            const email = req.params.email;
            console.log("offered help", email)
            const query = { donor: email };
            const result = await emergencyHelpOffersCollection.find(query).toArray();
            res.send(result);
        })

        // get each patient details for whom I offered help
        app.get('/offered-help/patient-details/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const filter = { _id: new ObjectId(id) };
            const result = await emergencyRequestsCollection.findOne(filter);
            console.log(result);
            res.send(result);
        })


        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log("for sign up fetch", user)
            const query = { email: user.email }

            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // This api is called after any donor offers help for a urgent request. 
        app.patch('/offer-help/:id', async (req, res) => {
            const id = req.params.id;
            const email = req.query.email;
            const saveRequest = req.body;

            const filter = { _id: new ObjectId(id) };

            // first find who posted urgent request using id
            const existedRequestResult = await emergencyRequestsCollection.findOne(filter);

            let offeredHelpDonors = [];
            let alreadyOffered = false; let resultRequestCollection; let resultAppliedRequestsCollection;
            const updateDoc = {
                $set: {
                    offeredHelp: offeredHelpDonors
                },
            };
            // console.log(existedRequestResult?.offeredHelp?.length)
            if (existedRequestResult?.offeredHelp?.length > 0) { // check if offeredHelp property is empty or not. If it is not empty

                console.log("im in offerhelp array is empty")

                if (!existedRequestResult.offeredHelp.includes(email)) {
                    //if it doesn't contain the donor email. Donor is offering help for the first time
                    offeredHelpDonors = [...existedRequestResult.offeredHelp, email];
                    resultRequestCollection = await emergencyRequestsCollection.updateOne(filter, updateDoc); //update offeredHelp property for that specific request donor has been triggered
                    resultAppliedRequestsCollection = await emergencyHelpOffersCollection.insertOne(saveRequest); //insert applied request into appliedRequest collection in db
                    console.log("Do something if")

                } else {
                    alreadyOffered = true; // Donor already offered before.
                }
            }
            else { //offeredHelp property is empty. No request is made still now.
                console.log('in offeredHelp false if')
                offeredHelpDonors.push(email)
                resultRequestCollection = await emergencyRequestsCollection.updateOne(filter, updateDoc);
                resultAppliedRequestsCollection = await emergencyHelpOffersCollection.insertOne(saveRequest); //insert applied request into appliedRequest collection in db
            }
            console.log({ resultRequestCollection, resultAppliedRequestsCollection, alreadyOffered });
            res.send({ resultRequestCollection, resultAppliedRequestsCollection, alreadyOffered });
        })


        // ** emergency request
        app.post('/patient/emergency-request', async (req, res) => {
            const Request = req.body;
            console.log(Request);

            const result = await emergencyRequestsCollection.insertOne(Request);
            res.send(result);
        });


        // post users who gave consent for alert
        app.post('/available-users/for-emergency-alerts/:email', async (req, res) => {
            const user = req.body;
            const email = req.params.email;
            // console.log("post available users. Users data:" , email, user)

            const locationData = {
                type: 'Point',
                coordinates: [user.longitudeOflocation, user.latitudeOflocation] // store as [longitude, latitude]
            };
            user.locationData = locationData;

            const query = { email: email }
            const existingUser = await availableUsersForAlertCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await availableUsersForAlertCollection.insertOne(user);
            console.log(result);
            res.send(result);
        });


        // get is the user already permit for notification
        app.get('/donor-permission/:email', async (req, res) => {
            // const user = req.body;
            const email = req.params.email;
            // console.log("email address" , email)
            const query = { email: email }

            const existingUser = await availableUsersForAlertCollection.findOne(query);

            if (existingUser) {
                return res.send({ userExist: true })
            }
            else {
                return res.send({ userExist: false })
            }
        });

        // update is the user already permit for notification
        app.patch('/update/donor-location/:email', async (req, res) => {
            const email = req.params.email;
            const updatedLocation = req.body;

            const locationData = {
                type: 'Point',
                coordinates: [updatedLocation.longitudeOflocation, updatedLocation.latitudeOflocation]
            };

            const query = { email: email };

            const updateDoc = {
                $set: {
                    latitudeOflocation: updatedLocation.latitudeOflocation,
                    longitudeOflocation: updatedLocation.longitudeOflocation,
                    locationData: locationData // Update the locationData field as well
                },
            };
            const result = await availableUsersForAlertCollection.updateOne(query, updateDoc);
            console.log("updated user", result)
            res.send(result);
        })

        // find-nearby-donors?latitude=${latitude}&longitude=${longitude}
        app.get('/find-nearby-donors', async (req, res) => {
            const { latitude, longitude } = req.query; // Get latitude and longitude from the request query


            const donors = await availableUsersForAlertCollection.aggregate([
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [parseFloat(longitude), parseFloat(latitude)] // Parse and use the provided latitude and longitude
                        },
                        distanceField: 'distance', // Field to store the calculated distance
                        maxDistance: 5000, // Max distance in meters (adjust as needed)
                        spherical: true
                    }
                }
            ]).toArray();

            res.json(donors);
        });




        /*------------blood recipients related apis---------
            -----------------------------------------------------*/

        // //secure recipients routes
        // app.get('/users/student/:email', async (req, res) => {
        //     const email = req.params.email;
        //     console.log(email)

        //     // if (req.decoded.email !== email) {
        //     //     res.send({ admin: false })
        //     // }

        //     const query = { email: email }
        //     const user = await usersCollection.findOne(query);
        //     const result =  user?.role === 'student' 
        //     res.send(result);
        // })



        /*------------ donors related apis ---------
            -----------------------------------------------------*/






    }
    finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('blood donation server is running')
})

app.listen(port, () => {
    console.log(`blood donation server is running on ${port}`);
})