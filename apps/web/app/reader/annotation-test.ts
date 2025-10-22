/**
 * Annotation System Test
 * Manual test script to verify annotation functionality
 * Run in browser console while viewing a PDF
 */

// Test 1: Create a rectangle annotation
async function testCreateRectangle() {
  const { createAnnotation } = await import("@deeprecall/data/repos/annotations");

  const annotation = await createAnnotation({
    sha256: "test-pdf-hash-123",
    page: 1,
    data: {
      type: "rectangle",
      rects: [{ x: 0.1, y: 0.1, width: 0.3, height: 0.2 }],
    },
    metadata: {
      color: "#fbbf24",
      title: "Test Rectangle",
      notes: "This is a test annotation",
      tags: ["test"],
    },
  });

  console.log("✅ Created rectangle annotation:", annotation.id);
  return annotation;
}

// Test 2: Create a highlight annotation
async function testCreateHighlight() {
  const { createAnnotation } = await import("@deeprecall/data/repos/annotations");

  const annotation = await createAnnotation({
    sha256: "test-pdf-hash-123",
    page: 2,
    data: {
      type: "highlight",
      ranges: [
        {
          text: "Important text here",
          rects: [{ x: 0.2, y: 0.3, width: 0.4, height: 0.05 }],
        },
      ],
    },
    metadata: {
      color: "#c084fc",
      title: "Key Concept",
    },
  });

  console.log("✅ Created highlight annotation:", annotation.id);
  return annotation;
}

// Test 3: Query annotations
async function testQueryAnnotations() {
  const { getPageAnnotations, getPDFAnnotations } = await import(
    "@deeprecall/data/repos/annotations"
  );

  const page1 = await getPageAnnotations("test-pdf-hash-123", 1);
  console.log("✅ Page 1 annotations:", page1.length);

  const all = await getPDFAnnotations("test-pdf-hash-123");
  console.log("✅ All annotations:", all.length);

  return { page1, all };
}

// Test 4: Test deterministic IDs
async function testDeterministicIDs() {
  const { createAnnotation } = await import("@deeprecall/data/repos/annotations");

  // Create same annotation twice
  const input = {
    sha256: "test-pdf-hash-123",
    page: 3,
    data: {
      type: "rectangle" as const,
      rects: [{ x: 0.5, y: 0.5, width: 0.1, height: 0.1 }],
    },
    metadata: {
      color: "#60a5fa",
    },
  };

  const ann1 = await createAnnotation(input);
  const ann2 = await createAnnotation(input);

  const idsMatch = ann1.id === ann2.id;
  console.log(idsMatch ? "✅ Deterministic IDs working" : "❌ IDs don't match");
  console.log("ID 1:", ann1.id);
  console.log("ID 2:", ann2.id);

  return idsMatch;
}

// Test 5: Test Zustand store
async function testZustandStore() {
  const { useAnnotationUI, hasActiveSelection } = await import(
    "@/src/stores/annotation-ui"
  );

  const store = useAnnotationUI.getState();

  // Test tool switching
  store.setTool("rectangle");
  console.log("✅ Tool:", store.tool);

  // Test selection
  store.setSelection({
    rectangles: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
    page: 1,
  });

  const hasSelection = hasActiveSelection(useAnnotationUI.getState());
  console.log(hasSelection ? "✅ Selection active" : "❌ No selection");

  store.clearSelection();
  console.log("✅ Selection cleared");

  return true;
}

// Run all tests
export async function runAnnotationTests() {
  console.log("🧪 Starting annotation system tests...\n");

  try {
    await testCreateRectangle();
    await testCreateHighlight();
    await testQueryAnnotations();
    await testDeterministicIDs();
    await testZustandStore();

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
}

// Export for console usage
if (typeof window !== "undefined") {
  (window as any).testAnnotations = {
    runAll: runAnnotationTests,
    createRectangle: testCreateRectangle,
    createHighlight: testCreateHighlight,
    query: testQueryAnnotations,
    deterministicIDs: testDeterministicIDs,
    zustand: testZustandStore,
  };

  console.log("💡 Annotation tests available: window.testAnnotations");
  console.log("   - runAll() - Run all tests");
  console.log("   - createRectangle() - Test rectangle creation");
  console.log("   - createHighlight() - Test highlight creation");
  console.log("   - query() - Test queries");
  console.log("   - deterministicIDs() - Test ID generation");
  console.log("   - zustand() - Test UI store");
}
