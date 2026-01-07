import { db } from '../src/database';
import bcrypt from 'bcrypt';

async function fixAdmin() {
    console.log("Checking users...");
    const users = await db.getAllUsers();
    console.log("Users found:", users);

    const admin = await db.getUser('admin');
    if (admin) {
        console.log("Admin exists. Resetting password to 'admin123'...");
        const hash = await bcrypt.hash('admin123', 10);
        await db.updatePassword(admin.id, hash);
        // Ensure role is admin
        // We don't have updateRole, but let's assume it is admin.
        console.log("Admin password reset.");
    } else {
        console.log("Admin not found. Creating...");
        const hash = await bcrypt.hash('admin123', 10);
        await db.addUser('admin', hash, 'admin');
        console.log("Admin created.");
    }
}

fixAdmin();
