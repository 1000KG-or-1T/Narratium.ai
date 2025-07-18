import { 
  ToolType, 
  ExecutionContext, 
  ExecutionResult,
  TaskEntry,
} from "../../models/agent-model";
import { BaseTool, ToolParameter, DetailedToolInfo } from "../base-tool";

/**
 * Reflect Tool - Pure Execution Unit
 * Adds new tasks with sub-problems to the task queue based on provided parameters from planner
 */
export class ReflectTool extends BaseTool {
  
  readonly toolType = ToolType.REFLECT;
  readonly name = "REFLECT";
  readonly description = "Add new tasks with sub-problems to the task queue when current tasks are finished but generation output is incomplete. Use ONLY when: 1) Task queue is empty but main objective is not yet complete, 2) Current tasks are finished but generation output is incomplete, 3) Need to create new tasks to continue progress toward completion, 4) Session is ending but final output quality is insufficient. DO NOT use for task refinement or sub-problem adjustment - that's handled by task optimization. This tool helps create new tasks to bridge gaps when existing work is complete but the overall objective remains unfinished. IMPORTANTLY: Also use this tool when the task queue is empty but the main objective is not yet complete - analyze what still needs to be done and generate the necessary tasks to finish the work. This tool helps maintain organized task flow and ensures comprehensive character and worldbook development.";
  
  readonly parameters: ToolParameter[] = [
    {
      name: "new_tasks",
      type: "string", 
      description: "XML-formatted task structure. Use nested XML elements: <task><description>task description</description><reasoning>task reasoning</reasoning><sub_problem>sub-problem 1</sub_problem><sub_problem>sub-problem 2</sub_problem></task>. Multiple tasks can be included by repeating the <task> element.",
      required: true,
    },
  ];

  getToolInfo(): DetailedToolInfo {
    return {
      type: ToolType.REFLECT,
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  protected async doWork(parameters: Record<string, any>, context: ExecutionContext): Promise<ExecutionResult> {
    const newTasksParam = parameters.new_tasks;
    
    if (!newTasksParam || typeof newTasksParam !== "string") {
      return this.createFailureResult("REFLECT tool requires 'new_tasks' parameter as a string with XML format.");
    }
    
    try {
      // Parse XML task structure
      const newTasks: TaskEntry[] = [];
      
      // Extract all <task> elements using regex
      const taskRegex = /<task>([\s\S]*?)<\/task>/g;
      let taskMatch;
      let taskIndex = 0;
      
      while ((taskMatch = taskRegex.exec(newTasksParam)) !== null) {
        const taskContent = taskMatch[1];
        
        // Extract description
        const descMatch = taskContent.match(/<description>([\s\S]*?)<\/description>/);
        if (!descMatch) {
          return this.createFailureResult(`REFLECT tool: Task ${taskIndex + 1} must have a <description> element.`);
        }
        const description = descMatch[1].trim();
        
        // Extract reasoning (optional)
        const reasoningMatch = taskContent.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
        const reasoning = reasoningMatch ? reasoningMatch[1].trim() : "Generated by reflection";
        
        // Extract sub-problems
        const subProblemRegex = /<sub_problem>([\s\S]*?)<\/sub_problem>/g;
        const subProblems = [];
        let subProblemMatch;
        let subIndex = 0;
        
        while ((subProblemMatch = subProblemRegex.exec(taskContent)) !== null) {
          const subProblemDesc = subProblemMatch[1].trim();
          subProblems.push({
            id: `reflect_sub_${Date.now()}_${taskIndex}_${subIndex}`,
            description: subProblemDesc,
            reasoning: "Generated by reflection",
          });
          subIndex++;
        }
        
        if (subProblems.length === 0) {
          return this.createFailureResult(`REFLECT tool: Task ${taskIndex + 1} must have at least one <sub_problem> element.`);
        }
        
        newTasks.push({
          id: `reflect_task_${Date.now()}_${taskIndex}`,
          description: description,
          reasoning: reasoning,
          sub_problems: subProblems,
        });
        
        taskIndex++;
      }
      
      if (newTasks.length === 0) {
        return this.createFailureResult("REFLECT tool: No valid <task> elements found in new_tasks parameter.");
      }

      return this.createSuccessResult({
        new_tasks: newTasks,
        tasks_count: newTasks.length,
      });
      
    } catch (error) {
      return this.createFailureResult(`REFLECT tool: Failed to parse XML task structure - ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 
