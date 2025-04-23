// promptTypes.ts
import { Annotation } from "@/app/types/deepRecall/strapi/annotationTypes";

export const fieldByTask: Record<string, keyof Annotation> = {
  extractToC:                   "tocExtractions",
  explainExercise:              "exerciseExplanations",
  solveExercise:                "exerciseSolutions",
  extractDataFromTableLatex:    "tableExtractions",
  extractDataFromTableMarkdown: "tableExtractions",
  extractDataFromTableCSV:      "tableExtractions",
  explainFigure:                "figureExplanations",
  explainIllustration:          "illustrationExplanations",
  convertToLatex:               "latexConversions",
  convertToMarkdown:            "markdownConversions",
};

// 1) Base types for API calls
export interface OpenAIPrompt {
  developerRolePrompt: string;
  userRolePrompt: string;
}

export interface OpenAIRequest extends OpenAIPrompt {
  model: string;
  images?: File[];
}

// 2) Your shared “prelude” for every prompt
const basePrompt = 
  "You are called via the API, embedded in a website; giving clearly formatted answers so the system can reliably process your answers. If using LaTeX, use $ or $$ for math environments, and never \[, \], \( or \)." +
  "If you are asked to write code, use the appropriate code fences for the language. " +
  "If you are asked to write a table, use the appropriate formatting for the requested format; but NEVER use pipes without backslashes within math environments.";

// 3) All of your prompt‐definitions in one const object
export const PromptTemplates = {
  extractToC: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that extracts the table of contents from an image. The image may be a screenshot of a PDF or similar document. Produce a JSON array of entries with the structure: [{ title: string; level: number; pageStart: number; pageEnd: number }]. If the image is unreadable or no TOC is detected, return [{ title: 'error'; level: 0; pageStart: 0; pageEnd: 0 }]. If headings are clear but page numbers are not, set pageStart and pageEnd to 0. Do not include any extra text.`,
    userRolePrompt:    "Please extract the table of contents from this image."
  },
  explainExercise: {
    developerRolePrompt: `${basePrompt} You are an AI tutor for advanced scientific and mathematical exercises. Given the text or screenshot of an exercise, provide a clear explanation of the exercise, highlighting key concepts and reasoning and provide hints for solving it. Do not provide a complete solution, but guide the user through the thought process and steps needed to arrive at the solution. Only return the markdown code; and if writing latex, write math environments with $ or $$.`,
    userRolePrompt:    "Please explain this exercise and provide hints for solving it."
  },
  solveExercise: {
    developerRolePrompt: `${basePrompt} You are an AI tutor for advanced scientific and mathematical exercises. Given the text or screenshot of an exercise, provide a complete solution with step-by-step reasoning. Include all necessary calculations and explanations to ensure clarity and understanding. Only return the markdown code; and if writing latex, write math environments with $ or $$.`,
    userRolePrompt:    "Please solve this exercise and provide a detailed explanation of the solution."
  },
  extractDataFromTableLatex: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that extracts data from a table image or text snippet and converts it into a LaTeX tabular environment. Ensure proper column alignment and include \\begin{tabular} and \\end{tabular} with headers and rows. If captions or labels are present, include them in the LaTeX code. Ensure correct formatting regarding math symbols and LaTeX syntax. Only return the LaTeX code without any additional text or explanations.`,
    userRolePrompt:    "Please extract the data from this table and provide it in LaTeX tabular format."
  },
  extractDataFromTableMarkdown: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that extracts data from a table image or text snippet and converts it into Markdown format. Ensure proper table formatting with pipes (|) and dashes (-) for headers and rows. If captions or labels are present, include them in the Markdown code. Make sure to write the pipes | for magnitudes (in equations) with a backslash, while pipes for the table should be written without a backslash. Only return the Markdown code without any additional text or explanations.`,
    userRolePrompt:    "Please extract the data from this table and provide it in Markdown format."
  },
  extractDataFromTableCSV: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that extracts data from a table image or text snippet and outputs a comma-separated values (CSV) string, with the first two lines as headers. The first line is as human readable as possible, while the second header line is a latex-style header; but only if math symbols are present. If the table headers only contain text, omit the second header line. Only return the CSV string without any additional text or explanations.`,
    userRolePrompt:    "Please extract the data from this table and present it as CSV."
  },
  explainFigure: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that interprets scientific and technical figures from images. Describe the axes, plot types, key trends, annotations, and the overall significance in context. Provide your answer in a markdown code block.`,
    userRolePrompt:    "Please explain the contents and significance of this figure."
  },
  explainIllustration: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that interprets scientific illustrations from images. Describe the components, their relationships, and the overall significance in context. Provide your answer in a markdown code block.`,
    userRolePrompt:    "Please explain the contents and significance of this illustration."
  },
  convertToLatex: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that translates images of mathematical equations, symbols, or diagrams into LaTeX code. Produce clean, compilable LaTeX math markup. Only return the LaTeX code without any additional text or explanations.`,
    userRolePrompt:    "Please convert the contents of this image into LaTeX."
  },
  convertToMarkdown: {
    developerRolePrompt: `${basePrompt} You are an AI assistant that extracts the content of an image—such as text blocks, simple diagrams, or screenshots—and reformats it into Markdown with appropriate headings, lists, code fences, and images. Ensure proper table formatting with pipes (|) and dashes (-) for headers and rows. If captions or labels are present, include them in the Markdown code. Make sure to write the pipes | for magnitudes (in equations) with a backslash, while pipes for the table should be written without a backslash. Only return the Markdown code without any additional text or explanations.`,
    userRolePrompt:    "Please convert the content of this image into Markdown format."
  }
} as const;

// 4) Helper types so TS knows exactly which keys & models are allowed
export type PromptKey       = keyof typeof PromptTemplates;
export type PromptTemplate  = typeof PromptTemplates[PromptKey];

export const AiTasks = {
    extractToC: {
      name:         "Extract Table of Contents" as const,
      description:  "Extracts the table of contents from an image, such as a screenshot of a PDF or document, and returns a structured JSON array of entries." as const,
      defaultModel: "gpt-4.1-nano" as const,
      promptKey:    "extractToC" as const
    },
    explainExercise: {
      name:         "Explain Exercise" as const,
      description:  "Explains a scientific or mathematical exercise, highlighting key concepts and providing hints for solving it without giving the full solution." as const,
      defaultModel: "o4-mini" as const,
      promptKey:    "explainExercise" as const
    },
    solveExercise: {
      name:         "Solve Exercise" as const,
      description:  "Solves a scientific or mathematical exercise, providing a complete step-by-step solution with explanations." as const,
      defaultModel: "o4-mini" as const,
      promptKey:    "solveExercise" as const
    },
    extractDataFromTableLatex: {
      name:         "Extract Data from Table in LaTeX format" as const,
      description:  "Extracts data from a table image or text and converts it into a LaTeX tabular environment, including headers and rows." as const,
      defaultModel: "gpt-4.1-mini" as const,
      promptKey:    "extractDataFromTableLatex" as const
    },
    extractDataFromTableMarkdown: {
      name:         "Extract Data from Table in Markdown format" as const,
      description:  "Extracts data from a table image or text and converts it into a properly formatted Markdown table." as const,
      defaultModel: "gpt-4.1-mini" as const,
      promptKey:    "extractDataFromTableMarkdown" as const
    },
    extractDataFromTableCSV: {
      name:         "Extract Data from Table in CSV format" as const,
      description:  "Extracts data from a table image or text and outputs it as a CSV string, with human-readable and LaTeX-style headers if applicable." as const,
      defaultModel: "gpt-4.1-mini" as const,
      promptKey:    "extractDataFromTableCSV" as const
    },
    explainFigure: {
      name:         "Explain Figure" as const,
      description:  "Interprets and explains the contents and significance of a scientific or technical figure from an image." as const,
      defaultModel: "o4-mini" as const,
      promptKey:    "explainFigure" as const
    },
    explainIllustration: {
      name:         "Explain Illustration" as const,
      description:  "Interprets and explains the components, relationships, and significance of a scientific illustration from an image." as const,
      defaultModel: "o4-mini" as const,
      promptKey:    "explainIllustration" as const
    },
    convertToLatex: {
      name:         "Convert image to LaTeX" as const,
      description:  "Converts images of mathematical equations, symbols, or diagrams into clean, compilable LaTeX code." as const,
      defaultModel: "gpt-4.1-mini" as const,
      promptKey:    "convertToLatex" as const
    },
    convertToMarkdown: {
      name:         "Convert image to Markdown" as const,
      description:  "Extracts and reformats the content of an image into Markdown, including text, tables, and simple diagrams." as const,
      defaultModel: "gpt-4.1-mini" as const,
      promptKey:    "convertToMarkdown" as const
    }
  } as const;
  
  export type AiTaskKey = keyof typeof AiTasks;
  export type AiTask    = typeof AiTasks[AiTaskKey];
  