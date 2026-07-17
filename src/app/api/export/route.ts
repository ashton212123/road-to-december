import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  phases,
  sessions,
  exercises,
  workoutLogs,
  weighIns,
  cmjTests,
  jumpTests,
  swimTimes,
  timeTo15m,
  foodLogs,
  waterLogs,
  sleepLogs,
  sorenessLogs,
  settings,
  businesses,
  businessTransactions,
  businessTasks,
  businessNotes,
} from "@/lib/db/schema";

// Full JSON dump of every table — the user must never be locked in.
// Auth-gated via proxy.ts like every other app route.
export async function GET() {
  const [
    phasesRows,
    sessionsRows,
    exercisesRows,
    workoutLogsRows,
    weighInsRows,
    cmjTestsRows,
    jumpTestsRows,
    swimTimesRows,
    timeTo15mRows,
    foodLogsRows,
    waterLogsRows,
    sleepLogsRows,
    sorenessLogsRows,
    settingsRows,
    businessesRows,
    businessTransactionsRows,
    businessTasksRows,
    businessNotesRows,
  ] = await Promise.all([
    db.select().from(phases),
    db.select().from(sessions),
    db.select().from(exercises),
    db.select().from(workoutLogs),
    db.select().from(weighIns),
    db.select().from(cmjTests),
    db.select().from(jumpTests),
    db.select().from(swimTimes),
    db.select().from(timeTo15m),
    db.select().from(foodLogs),
    db.select().from(waterLogs),
    db.select().from(sleepLogs),
    db.select().from(sorenessLogs),
    db.select().from(settings),
    db.select().from(businesses),
    db.select().from(businessTransactions),
    db.select().from(businessTasks),
    db.select().from(businessNotes),
  ]);

  const dump = {
    exportedAt: new Date().toISOString(),
    phases: phasesRows,
    sessions: sessionsRows,
    exercises: exercisesRows,
    workoutLogs: workoutLogsRows,
    weighIns: weighInsRows,
    cmjTests: cmjTestsRows,
    jumpTests: jumpTestsRows,
    swimTimes: swimTimesRows,
    timeTo15m: timeTo15mRows,
    foodLogs: foodLogsRows,
    waterLogs: waterLogsRows,
    sleepLogs: sleepLogsRows,
    sorenessLogs: sorenessLogsRows,
    settings: settingsRows,
    businesses: businessesRows,
    businessTransactions: businessTransactionsRows,
    businessTasks: businessTasksRows,
    businessNotes: businessNotesRows,
  };

  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="road-to-december-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
