export type MistakeTaxonomyItem = {
  primaryReason: string;
  secondaryReasons: string[];
};

export const mistakeTaxonomy: MistakeTaxonomyItem[] = [
  {
    primaryReason: "Syntax / API Error",
    secondaryReasons: [
      "Syntax mistake",
      "Incorrect variable name",
      "Type error",
      "Misused standard library API",
      "Unfamiliar language feature"
    ]
  },
  {
    primaryReason: "Problem Understanding Error",
    secondaryReasons: [
      "Misunderstood input/output",
      "Missed constraints",
      "Misunderstood target condition",
      "Missed special rule"
    ]
  },
  {
    primaryReason: "Algorithmic Approach Error",
    secondaryReasons: [
      "Wrong algorithm choice",
      "Wrong data structure choice",
      "Incorrect state definition",
      "Incorrect transition relation",
      "Incorrect greedy condition",
      "Incorrect search pruning"
    ]
  },
  {
    primaryReason: "Missing Edge Case",
    secondaryReasons: [
      "Empty input",
      "Single element",
      "Duplicate elements",
      "Negative numbers / zero",
      "Out-of-bounds",
      "Min/max values",
      "Odd/even length"
    ]
  },
  {
    primaryReason: "Implementation Detail Error",
    secondaryReasons: [
      "Indexing error",
      "Incorrect loop condition",
      "Incorrect initialization",
      "Wrong update order",
      "Wrong return value",
      "Incorrect pointer movement"
    ]
  },
  {
    primaryReason: "Complexity Issue",
    secondaryReasons: [
      "Time complexity too high",
      "Space complexity too high",
      "Repeated computation",
      "Missing memoization",
      "Inefficient data structure operation"
    ]
  },
  {
    primaryReason: "Debugging Habit Issue",
    secondaryReasons: [
      "Did not manually test examples",
      "Did not check extreme cases",
      "Introduced bug after modification",
      "Submitted too early",
      "Did not verify complexity"
    ]
  }
];
