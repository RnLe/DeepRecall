# File structure for strapi responses
Files in folders called `strapi` are imitating the database structure and are built the following way:
- Each file has an interface which resembles the database object. This interface / type has the suffix `Strapi`, e.g. `AnnotationStrapi`, `KnowledgePackStrapi`, etc.
- Each of these extend the `StrapiResponse` interface, which is metadata that is sent with each strapi data fetch / response, making this type resemble the full strapi database object.
- Each of these files basically generate a main type, e.g. `Annotation` (from the database response `AnnotationStrapi`). This is done to keep some fields flexible without the need of modifying the Strapi tables too much. Also, this method produces one definite and easy to handle object for the frontend to work with.
  - To translate between the object that is used by the frontend (e.g. `Annotation`) and the one which is used by the Strapi backend (e.g. `AnnotationStrapi`), two functions are introduced: `serializeAnnotation()` and `deserializeAnnotation()`. They translate between those types respectively.
- Each file can have intermediate types to facilitate semantics.