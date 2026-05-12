import * as ce from "@clerk/express";
console.log("clerkClient:", typeof ce.clerkClient);
console.log("exports:", Object.keys(ce).filter(k => k.toLowerCase().includes("clerk")).join(", "));