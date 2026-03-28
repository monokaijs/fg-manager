import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    // We didn"t set up the rust command in this basic setup yet, but we will mock it if invoke fails.
    try {
      setGreetMsg(await invoke("greet", { name }));
    } catch {
      setGreetMsg(
        `Hello, ${name || "Tauri Developer"}! Welcome to fg-manager.`,
      );
    }
  }

  return (
    <div className="flex bg-background items-center justify-center min-h-screen p-4 text-foreground dark">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-light tracking-tight mb-2">
            Welcome to{" "}
            <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-500">
              Tauri
            </span>
          </CardTitle>
          <CardDescription>
            A beautiful Turborepo, Vite, React, Tailwind v4 and Shadcn stack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <Input
              id="greet-input"
              type="text"
              placeholder="Enter a name..."
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <Button
              onClick={greet}
              className="w-full font-medium"
            >
              Greet
            </Button>
          </div>
          {greetMsg && (
            <div className="mt-6 p-4 rounded-md bg-secondary text-secondary-foreground text-center animate-in fade-in slide-in-from-bottom-2">
              <p className="text-md font-medium text-emerald-600 dark:text-emerald-400">{greetMsg}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-sm text-center text-muted-foreground justify-center">
          Powered by fg-manager
        </CardFooter>
      </Card>
    </div>
  );
}

export default App;
