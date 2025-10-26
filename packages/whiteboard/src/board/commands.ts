/**
 * Commands - Undo/Redo Operations
 */

import type { Command } from "./orchestrator";
import type { BoardOrchestrator } from "./orchestrator";
import type { AnySceneObject } from "../scene/objects";

/**
 * Add object command
 */
export class AddObjectCommand implements Command {
  type = "addObject";

  constructor(
    private board: BoardOrchestrator,
    private object: AnySceneObject
  ) {}

  execute(): void {
    this.board.addObject(this.object);
  }

  undo(): void {
    this.board.removeObject(this.object.id);
  }
}

/**
 * Remove object command
 */
export class RemoveObjectCommand implements Command {
  type = "removeObject";
  private removedObject: AnySceneObject | undefined;

  constructor(
    private board: BoardOrchestrator,
    private objectId: string
  ) {}

  execute(): void {
    this.removedObject = this.board.getObject(this.objectId);
    this.board.removeObject(this.objectId);
  }

  undo(): void {
    if (this.removedObject) {
      this.board.addObject(this.removedObject);
    }
  }
}

/**
 * Batch command (multiple commands as one)
 */
export class BatchCommand implements Command {
  type = "batch";

  constructor(private commands: Command[]) {}

  execute(): void {
    this.commands.forEach((cmd) => cmd.execute());
  }

  undo(): void {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
