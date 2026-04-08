# 🎒 Reporter - Super Easy Secondary School Report Card Drafting System!

Hey there! This is **Reporter**, a super-smart app that helps schools make beautiful report cards for students. Even a toddler can run it! Just follow these simple steps.

---

## 🚀 1. How to Start (The "Laptop" Part)

1. **Install Node.js**: Make sure your laptop has Node.js installed.
2. **Setup**: Open your terminal (that black window where you type things) and type:
   ```bash
   npm install
   ```
3. **Run the App**: Type this to start the engine:
   ```bash
   node server.js
   ```
4. **Open Chrome**: Go to `http://localhost:3000`. Boom! You are in.

---

## 📂 2. Where do the Files Go? (The "Box" Part)

The app reads Excel files. You just need to put them in the right "boxes" (folders).

### 🏷️ **BOX 1: The Master Folder (Students)**

- **What goes here?** Lists of student names and their ID numbers.
- **Where?** `Master/` -> `[Session Name]/` -> `[Class Name].xlsx`
- **Example:** `Master/2025_and_2026/JSS1.xlsx`
- **Action:** After adding files here, run `node import.js` to tell the app about the students.

### 📝 **BOX 2: The aReport_card Folder (Scores)**

- **What goes here?** Exam scores and CA test scores.
- **Where?** `aReport_card/` -> `[Session]/` -> `[Term]/` -> `[Class]/` -> `[Term]_[Class]_[Subject].xlsx`
- **Example:** `aReport_card/2025_2026/First_term/JSS1/Mathematics.xlsx`
- **Tip:** You can also put ONE big file for the whole class if you want!

### 🌟 **BOX 3: The Extra_curricular Folder (Activities)**

- **What goes here?** Punctuality, Neatness, Teacher Comments, and Clubs.
- **Where?** `Extra_curricular/` -> `[Session]/` -> `[Term]/` -> `[Class]/` -> `extra_[Class]_[Term]_[Session].xlsx`
- **Example:** `Extra_curricular/2025_2026/First_term/JSS1/extra_jss1_First_term_2025_2026.xlsx`

---

## 🔑 3. How to See Results?

### 👨‍🎓 **For Students:**

- **Admission No:** Use your ID (Example: `28105`).
- **Surname:** Use your last name (Example: "KUNKERE").
- Click "Login" and see your beautiful report card!

### 👨‍💼 **For Admin (The Boss):**

- Go to `http://localhost:3000/admin`.
- Use the secret admin password to see everybody's results and stats.

---

## 🛠️ 4. Making Changes

- **Principal Remarks**: The app is super smart! It knows your name. If you scored low in Math, it will say: "**Kehinde**, you need to work harder on **MATHEMATICS**."
- **Database**: All the data is saved in a file called `school.db`. Don't delete it!

---

### **Summary:**

1. Put Excel files in folders.
2. Run `node import.js` once.
3. Run `node server.js` always.
4. Open the website.
5. Printing time! 🖨️

Enjoy your reporting! 🍦
