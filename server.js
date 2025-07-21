const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const session = require('express-session');

const app = express();
const port = 3019;

// Middleware
app.use(express.static(path.join(__dirname)));  // Serve static files
app.use(express.json());  // Parse JSON request body
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded request bodies

// Session middleware for user authentication
app.use(
    session({
        secret: 'my_secret_key',
        resave: false,
        saveUninitialized: false,
    })
);

// MongoDB Connection
mongoose
    .connect('mongodb://127.0.0.1:27017/users', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connection successful'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Schema and Models

// User Schema
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
});

// Expense Schema
const expenseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },  // Storing date as a string in 'DD-MM-YYYY' format
});

// Savings Schema
const savingsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    date: { type: String, required: true },  // Storing date as a string in 'YYYY-MM-DD' format
});

// Model for Savings
const Savings = mongoose.model('Savings', savingsSchema);

// Models for User and Expense
const User = mongoose.model('User', userSchema);
const Expense = mongoose.model('Expense', expenseSchema);

// Routes


// Add a new savings entry
// Add a new savings entry
app.post('/add-savings', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).send('Unauthorized: Please log in first.');
        }

        const { amount, date } = req.body;

        // Validate the date format: "DD-MM-YYYY"
        const datePattern = /^\d{2}-\d{2}-\d{4}$/;
        if (!datePattern.test(date)) {
            return res.status(400).send('Invalid date format. Please use "DD-MM-YYYY".');
        }

        // Create and save the new savings entry
        const newSavings = new Savings({
            userId: req.session.userId,
            amount,
            date,  // Save the date as received (in "DD-MM-YYYY" format)
        });

        await newSavings.save();
        res.json(newSavings);
    } catch (err) {
        console.error('Error adding savings:', err);
        res.status(500).send('Error occurred while adding savings.');
    }
});

app.post('/retrieve-password', async (req, res) => {
    const { username, email } = req.body;

    try {
        // Find the user in the database
        const user = await User.findOne({ username, email });
        if (!user) {
            return res.status(404).send('User not found.');
        }

        res.json({ password: user.password });
    } catch (err) {
        console.error('Error retrieving password:', err);
        res.status(500).send('Error occurred while retrieving password.');
    }
});

// Serve the homepage (login/register page)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'front.html'));  // Serve the login/register page
});

// Serve the dashboard page if the user is logged in
app.get('/dashboard', (req, res) => {
    if (!req.session.userId) {  // Check if the user is logged in
        return res.redirect('/');  // If not, redirect to login page
    }
    res.sendFile(path.join(__dirname, 'dashboard.html'));  // Serve the dashboard
});

// Register a new user
app.post('/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;
        
        if (password !== confirmPassword) {
            return res.status(400).send('Passwords do not match.');
        }
  
        // Check for duplicate email
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('Email already registered. Please use another email.');
        }

        // Create a new user and save to the database
        const user = new User({ username, email, password });
        await user.save();
        res.send('Registration Successful');
    } catch (err) {
        console.error('Error saving data:', err);
        res.status(500).send('Error occurred while registering.');
    }
});

// Login user
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check for valid credentials
        const user = await User.findOne({ username });
        if (!user || user.password !== password) {
            return res.status(400).send('Invalid username or password');
        }

        // Set session userId for the logged-in user
        req.session.userId = user._id;
        res.redirect('/dashboard');
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('Error occurred while logging in.');
    }
});

app.get('/profile', async (req, res) => {
    try {
        // Ensure the user is logged in
        if (!req.session.userId) {
            return res.status(401).send('Unauthorized: Please log in first.');
        }

        // Fetch the user details from the database using the userId stored in the session
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }

        // Send user profile details (excluding password)
        res.json({
            username: user.username,
            email: user.email,
        });
    } catch (err) {
        console.error('Error fetching profile details:', err);
        res.status(500).send('Error occurred while fetching profile details.');
    }
});

app.get('/monthly-dashboard', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized: Please log in first.');
    }

    try {
        // Get user details
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).send('User not found.');
        }

        // Get the current date to calculate the start and end of the current month
        const now = new Date();
        const startOfMonth = `01-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
        const endOfMonth = `${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

        console.log('Start of month:', startOfMonth);
        console.log('End of month:', endOfMonth);

        // Fetch total expenses for the current month
        const totalExpenses = await Expense.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),
                    date: { $gte: startOfMonth.trim(), $lte: endOfMonth.trim() }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        console.log('Total Expenses:', totalExpenses);

        // Fetch total savings for the current month
        const totalSavings = await Savings.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),
                    date: { $gte: startOfMonth.trim(), $lte: endOfMonth.trim() }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        console.log('Total Savings:', totalSavings);

        // Send response structured for your frontend
        res.json({
            totalExpenses: totalExpenses.length > 0 ? totalExpenses[0].totalAmount : 0,
            totalSavings: totalSavings.length > 0 ? totalSavings[0].totalAmount : 0
        });
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
        res.status(500).send('Error occurred while fetching dashboard data.');
    }
});


// Fetch today's expenses for the logged-in user
app.get('/expenses/today', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
    }

    try {
        // Get the current date in 'DD-MM-YYYY' format
        const dateObj = new Date();
        const startOfDay = new Date(dateObj.setHours(0, 0, 0, 0));  // Midnight of today
        const endOfDay = new Date(dateObj.setHours(23, 59, 59, 999));  // Last moment of today

        // Format the date to 'DD-MM-YYYY' for string comparison in database
        const formattedStartDate = `${("0" + startOfDay.getDate()).slice(-2)}-${("0" + (startOfDay.getMonth() + 1)).slice(-2)}-${startOfDay.getFullYear()}`;
        const formattedEndDate = `${("0" + endOfDay.getDate()).slice(-2)}-${("0" + (endOfDay.getMonth() + 1)).slice(-2)}-${endOfDay.getFullYear()}`;

        // Aggregate expenses for the logged-in user by category for today (based on formatted string date)
        const expenses = await Expense.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),  // Correct usage of ObjectId with 'new'
                    date: { $gte: formattedStartDate, $lte: formattedEndDate }  // Matching string date range
                }
            },
            {
                $group: {
                    _id: "$category",
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        // Calculate the total amount for all expenses
        const totalAmount = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);

        // Fetch the username of the logged-in user
        const user = await User.findById(req.session.userId);
        const username = user ? user.username : "User";

        // Send back the total amount and expenses by category
        res.json({ username, totalAmount, expenses });
    } catch (err) {
        console.error('Error fetching today\'s expenses:', err);
        res.status(500).json({ error: 'Error occurred while fetching today\'s expenses.' });
    }
});



// Fetch all expenses for the logged-in user
app.get('/expenses', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized: Please log in first.');  // Ensure user is logged in
    }

    try {
        // Fetch all expenses for the logged-in user
        const expenses = await Expense.find({ userId: req.session.userId });
        res.json(expenses);
    } catch (err) {
        console.error('Error fetching expenses:', err);
        res.status(500).send('Error occurred while fetching expenses.');
    }
});

// Add a new expense
app.post('/add-expenses', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).send('Unauthorized: Please log in first.');
        }

        const { name, amount, category, date } = req.body;

        // Convert the date string to Date object and format it as 'DD-MM-YYYY'
        const dateObj = new Date(date);  // Assuming the date is passed as a valid date string
        const formattedDate = `${("0" + dateObj.getDate()).slice(-2)}-${("0" + (dateObj.getMonth() + 1)).slice(-2)}-${dateObj.getFullYear()}`;

        // Create and save a new expense
        const newExpense = new Expense({
            userId: req.session.userId,
            name,
            amount,
            category,
            date: formattedDate,  // Save the formatted date string
        });

        await newExpense.save();
        res.json(newExpense);
    } catch (err) {
        console.error('Error adding expense:', err);
        res.status(500).send('Error occurred while adding expense.');
    }
});
// Define a color mapping for categories
const categoryColors = {
    "Food": "rgba(255, 99, 132, 1.0)",
    "Transport": "rgba(54, 162, 235, 1.0)",
    "Entertainment": "rgba(255, 206, 86, 1.0)",
    "Shopping": "rgba(75, 192, 192, 1.0)",
    "Bills": "rgba(153, 102, 255, 1.0)",
    "Health": "rgba(255, 159, 64, 1.0)",
    // Add more categories and their colors as needed
};

// Fetch expenses comparison for the last 3 days
app.get('/api/expenses/comparison', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
    }

    try {
        const today = new Date();
        const last3Days = [];
        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formattedDate = `${("0" + date.getDate()).slice(-2)}-${("0" + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
            last3Days.push(formattedDate);
        }

        // Aggregate expenses for the logged-in user by category for each of the last 3 days
        const expenses = await Expense.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),
                    date: { $in: last3Days }
                }
            },
            {
                $group: {
                    _id: { date: "$date", category: "$category" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.date": 1 }  // Sort by date ascending
            }
        ]);

        // Organize expenses into a format suitable for the chart
        const days = last3Days;
        const chartData = [];
        const categories = [...new Set(expenses.map(exp => exp._id.category))]; // Get all unique categories

        // Initialize data structure for chart
        categories.forEach(category => {
            const categoryData = {
                label: category,
                data: [0, 0, 0],  // Default to 0 for each day
                backgroundColor: categoryColors[category] || 'rgba(0, 0, 0, 1.0)',  // Default color if not in the map
                borderColor: categoryColors[category] ? categoryColors[category].replace('0.2', '1') : 'rgba(0, 0, 0, 1)', // Darker border
                borderWidth: 1
            };

            // Populate data for the category
            expenses.forEach(exp => {
                if (exp._id.category === category) {
                    const dayIndex = days.indexOf(exp._id.date);
                    if (dayIndex !== -1) {
                        categoryData.data[dayIndex] = exp.totalAmount;
                    }
                }
            });

            chartData.push(categoryData);
        });

        // Send the data as a response
        res.json({ days, chartData });
    } catch (err) {
        console.error('Error fetching expense comparison data:', err);
        res.status(500).json({ error: 'Error occurred while fetching expense comparison data.' });
    }
});
// Fetch expenses comparison for the last 7 days
app.get('/api/expenses/week-summary', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
    }

    try {
        const today = new Date();
        const last7Days = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formattedDate = `${("0" + date.getDate()).slice(-2)}-${("0" + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
            last7Days.push(formattedDate);
        }

        // Aggregate expenses for the logged-in user by category for each of the last 7 days
        const expenses = await Expense.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),
                    date: { $in: last7Days }
                }
            },
            {
                $group: {
                    _id: { date: "$date", category: "$category" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.date": 1 }  // Sort by date ascending
            }
        ]);

        // Organize expenses into a format suitable for the chart
        const days = last7Days;
        const chartData = [];
        const categories = [...new Set(expenses.map(exp => exp._id.category))]; // Get all unique categories

        // Initialize data structure for chart
        categories.forEach(category => {
            const categoryData = {
                label: category,
                data: Array(7).fill(0),  // Default to 0 for each day
                backgroundColor: categoryColors[category] || 'rgba(0, 0, 0, 1.0)',  // Default color if not in the map
                borderColor: categoryColors[category] ? categoryColors[category].replace('0.2', '1') : 'rgba(0, 0, 0, 1)', // Darker border
                borderWidth: 1
            };

            // Populate data for the category
            expenses.forEach(exp => {
                if (exp._id.category === category) {
                    const dayIndex = days.indexOf(exp._id.date);
                    if (dayIndex !== -1) {
                        categoryData.data[dayIndex] = exp.totalAmount;
                    }
                }
            });

            chartData.push(categoryData);
        });

        // Send the data as a response
        res.json({ days, chartData });
    } catch (err) {
        console.error('Error fetching expense comparison data:', err);
        res.status(500).json({ error: 'Error occurred while fetching expense comparison data.' });
    }
});
// Fetch expenses for the last 30 days
app.get('/api/expenses/last30days', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized: Please log in first.' });
    }

    try {
        const today = new Date();
        const last30Days = [];
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const formattedDate = `${("0" + date.getDate()).slice(-2)}-${("0" + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;
            last30Days.push(formattedDate);
        }

        // Aggregate expenses for the logged-in user by category for each of the last 30 days
        const expenses = await Expense.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.session.userId),
                    date: { $in: last30Days }
                }
            },
            {
                $group: {
                    _id: { date: "$date", category: "$category" },
                    totalAmount: { $sum: "$amount" }
                }
            },
            {
                $sort: { "_id.date": 1 }  // Sort by date ascending
            }
        ]);

        // Organize expenses into a format suitable for the chart
        const days = last30Days;
        const chartData = [];
        const categories = [...new Set(expenses.map(exp => exp._id.category))]; // Get all unique categories

        // Initialize data structure for chart
        categories.forEach(category => {
            const categoryData = {
                label: category,
                data: Array(30).fill(0),  // Default to 0 for each day
                backgroundColor: categoryColors[category] || 'rgba(0, 0, 0, 1.0)',  // Default color if not in the map
                borderColor: categoryColors[category] ? categoryColors[category].replace('0.2', '1') : 'rgba(0, 0, 0, 1)', // Darker border
                borderWidth: 1
            };

            // Populate data for the category
            expenses.forEach(exp => {
                if (exp._id.category === category) {
                    const dayIndex = days.indexOf(exp._id.date);
                    if (dayIndex !== -1) {
                        categoryData.data[dayIndex] = exp.totalAmount;
                    }
                }
            });

            chartData.push(categoryData);
        });

        // Send the data as a response
        res.json({ days, chartData });
    } catch (err) {
        console.error('Error fetching expense comparison data:', err);
        res.status(500).json({ error: 'Error occurred while fetching expense comparison data.' });
    }
});

// Update an existing expense
app.put('/update-expense/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).send('Unauthorized: Please log in first.');
        }

        const { id } = req.params;
        const { name, amount, category, date } = req.body;

        // Convert the date string to Date object and format it as 'DD-MM-YYYY'
        const dateObj = new Date(date);  // Assuming the date is passed as a valid date string
        const formattedDate = `${("0" + dateObj.getDate()).slice(-2)}-${("0" + (dateObj.getMonth() + 1)).slice(-2)}-${dateObj.getFullYear()}`;

        // Find and update the expense
        const updatedExpense = await Expense.findOneAndUpdate(
            { _id: id, userId: req.session.userId },
            { name, amount, category, date: formattedDate },  // Update with formatted date string
            { new: true }
        );

        if (!updatedExpense) {
            return res.status(404).send('Expense not found or not authorized.');
        }

        res.json(updatedExpense);
    } catch (err) {
        console.error('Error updating expense:', err);
        res.status(500).send('Error occurred while updating expense.');
    }
});

// Delete an expense
app.delete('/delete-expense/:id', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).send('Unauthorized: Please log in first.');
        }

        const { id } = req.params;
        const deletedExpense = await Expense.findOneAndDelete({
            _id: id,
            userId: req.session.userId,
        });

        if (!deletedExpense) {
            return res.status(404).send('Expense not found or not authorized.');
        }

        res.sendStatus(200);  // Respond with success (200 OK)
    } catch (err) {
        console.error('Error deleting expense:', err);
        res.status(500).send('Error occurred while deleting expense.');
    }
});

// Logout user
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Error occurred while logging out.');
        }
        res.redirect('/');  // Redirect to login page after logout
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
