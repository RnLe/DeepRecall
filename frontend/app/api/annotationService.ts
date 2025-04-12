// annotationService.ts
// A service to manage database handling for annotations.

import { Annotation } from "../helpers/annotationTypes";

const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN;
const BASE_URL = "http://localhost:1337/api/annotations";

