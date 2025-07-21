document.addEventListener("DOMContentLoaded", () => {
    const expenseForm = document.getElementById("expense-form");
    const expenseList = document.getElementById("expense-list");
    const totalAmount = document.getElementById("total-amount");
    const filterCategory = document.getElementById("filter-category");
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const filterDateRangeButton = document.getElementById("filter-date-range");
    const addSuccessMessage = document.getElementById("add-success-message");
    const deleteSuccessMessage = document.getElementById("delete-success-message");
    const errorMessage = document.getElementById("error-message");

    let expenses = [];
    let monthlySavings = 0; // Dynamically fetched savings value

    // Fetch monthly data dynamically (savings and expenses)
    async function fetchMonthlyData() {
        try {
            const response = await fetch('/monthly-dashboard');
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const data = await response.json();
            console.log(data);

            // Update global monthly savings variable
            monthlySavings = data.totalSavings;

            // Update the dashboard UI
            document.getElementById('monthly-expenses').textContent = data.totalExpenses.toFixed(2);
            document.getElementById('monthly-savings').textContent = monthlySavings.toFixed(2);
        } catch (error) {
            console.error("Error fetching monthly data:", error);
        }
    }

    // Fetch expenses from the server on page load
    fetch('/expenses')
        .then(response => response.json())
        .then(data => {
            expenses = data;
            displayExpenses(expenses);
            updateTotalAmount();
        })
        .catch(err => console.error('Error fetching expenses:', err));

    // Fetch monthly data on page load
    fetchMonthlyData();

    // Add Expense
    expenseForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("expense-name").value;
        const amount = parseFloat(document.getElementById("expense-amount").value);
        const category = document.getElementById("expense-category").value;
        const date = document.getElementById("expense-date").value;

        const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        const newTotalExpenses = totalExpenses + amount;

        if (newTotalExpenses > monthlySavings) {
            errorMessage.textContent = "Cannot add expense. Total expenses exceeds income.";
            errorMessage.style.display = "block";
            setTimeout(() => {
                errorMessage.style.display = "none";
            }, 5000);
            return;
        }

        const expense = { name, amount, category, date };

        fetch('/add-expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expense),
        })
            .then(response => response.json())
            .then(data => {
                expenses.push(data); // Add new expense to local list
                displayExpenses(expenses);
                updateTotalAmount();
                expenseForm.reset();

                // Show success message for adding
                showAddSuccessMessage();
            })
            .catch(err => console.error('Error adding expense:', err));
    });

    // Delete or Edit Expense
    expenseList.addEventListener("click", (e) => {
        const id = e.target.dataset.id;

        if (e.target.classList.contains("delete-btn")) {
            fetch(`/delete-expense/${id}`, { method: 'DELETE' })
                .then(() => {
                    expenses = expenses.filter(expense => expense._id !== id); // Remove expense from local list
                    displayExpenses(expenses);
                    updateTotalAmount();

                    // Show success message for deletion
                    showDeleteSuccessMessage();
                })
                .catch(err => console.error('Error deleting expense:', err));
        }

        if (e.target.classList.contains("edit-btn")) {
            const expense = expenses.find(expense => expense._id === id);

            document.getElementById("expense-name").value = expense.name;
            document.getElementById("expense-amount").value = expense.amount;
            document.getElementById("expense-category").value = expense.category;
            document.getElementById("expense-date").value = expense.date;

            // Remove the expense from the list temporarily
            expenses = expenses.filter(expense => expense._id !== id);

            // Update the expense in the database
            fetch(`/update-expense/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense),
            })
                .then(response => response.json())
                .then(updatedExpense => {
                    expenses.push(updatedExpense); // Add updated expense back to the list
                    displayExpenses(expenses);
                    updateTotalAmount();
                })
                .catch(err => console.error('Error updating expense:', err));
        }
    });

    // Filter by Date Range
    filterDateRangeButton.addEventListener("click", () => {
        const startDateValue = startDateInput.value;
        const endDateValue = endDateInput.value;

        if (!startDateValue || !endDateValue) {
            alert("Please select both start and end dates.");
            return;
        }

        const startDate = new Date(startDateValue);
        const endDate = new Date(endDateValue);

        const filteredExpenses = expenses.filter(expense => {
            const [day, month, year] = expense.date.split("-").map(Number);
            const expenseDate = new Date(year, month - 1, day);

            return expenseDate >= startDate && expenseDate <= endDate;
        });

        if (filteredExpenses.length > 0) {
            displayExpenses(filteredExpenses);
        } else {
            alert("No expenses found within the selected date range.");
        }
    });

    // Filter Expenses
    filterCategory.addEventListener("change", (e) => {
        const category = e.target.value;
        if (category === "All") {
            displayExpenses(expenses);
        } else {
            const filteredExpenses = expenses.filter(expense => expense.category === category);
            displayExpenses(filteredExpenses);
        }
    });

    // Display Expenses
    function displayExpenses(expenses) {
        expenseList.innerHTML = "";
        expenses.forEach(expense => {
            const dateParts = expense.date.split("-");
            const [day, month, year] = dateParts;
            const date = new Date(`${year}-${month}-${day}`);
            const formattedDate = `${("0" + date.getDate()).slice(-2)}-${("0" + (date.getMonth() + 1)).slice(-2)}-${date.getFullYear()}`;

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${expense.name}</td>
                <td>${expense.amount.toFixed(2)}</td>
                <td>${expense.category}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="edit-btn" data-id="${expense._id}">Edit</button>
                    <button class="delete-btn" data-id="${expense._id}">Delete</button>
                </td>
            `;

            expenseList.appendChild(row);
        });
    }

    // Update Total Amount
    function updateTotalAmount() {
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        totalAmount.textContent = total.toFixed(2);
    }

    // Show success message for adding
    function showAddSuccessMessage() {
        addSuccessMessage.style.display = "block";
        setTimeout(() => {
            addSuccessMessage.style.display = "none";
        }, 3000);
    }

    // Show success message for deletion
    function showDeleteSuccessMessage() {
        deleteSuccessMessage.style.display = "block";
        setTimeout(() => {
            deleteSuccessMessage.style.display = "none";
        }, 3000);
    }
});
