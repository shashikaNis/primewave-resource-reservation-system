import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { reservations, resources, users } from "./schema";

const db = drizzle(process.env.DATABASE_URL!);
function dateAt(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function main() {
  await db.delete(reservations);
  await db.delete(resources);
  await db.delete(users);

  const [admin, nimal, kamala] = await db
    .insert(users)
    .values([
      { name: "Admin User", email: "admin@primewave.lk", role: "admin" },
      { name: "Nimal Perera", email: "nimal@primewave.lk" },
      { name: "Kamala Silva", email: "kamala@primewave.lk" },
    ])
    .returning();

  const [boardRoom, meetingRoom, projector, van] = await db
    .insert(resources)
    .values([
      { name: "Board Room", type: "Meeting Room", location: "Floor 3", capacity: 12 },
      { name: "Meeting Room A", type: "Meeting Room", location: "Floor 2", capacity: 6 },
      { name: "Projector 1", type: "Equipment", location: "IT Store" },
      { name: "Company Van", type: "Vehicle", location: "Car Park", capacity: 8 },
    ])
    .returning();

  await db.insert(reservations).values([
    { resourceId: boardRoom.id, userId: admin.id, title: "Management meeting", startTime: dateAt(0, 9), endTime: dateAt(0, 10) },
    { resourceId: boardRoom.id, userId: nimal.id, title: "Client presentation", startTime: dateAt(0, 10), endTime: dateAt(0, 12) },
    { resourceId: meetingRoom.id, userId: kamala.id, title: "Team stand-up", startTime: dateAt(1, 9), endTime: dateAt(1, 10) },
    { resourceId: projector.id, userId: nimal.id, title: "Training session", startTime: dateAt(1, 13), endTime: dateAt(1, 16) },
    { resourceId: van.id, userId: kamala.id, title: "Site visit", startTime: dateAt(2, 8), endTime: dateAt(2, 17) },
  ]);

  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$client.end());
