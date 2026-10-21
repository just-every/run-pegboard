// Safe explanations never name a hidden dependency or reveal its value.
const explanations:Record<string,string>={
 CYCLE:'This calculation contains a dependency cycle. Ask a project Admin to review its definition.',
 INPUT_UNAVAILABLE:'A required field or related task is unavailable to you. Its input values are not shown.',
 MISSING_INPUT:'Add a value for each required input to calculate this result.',
 NON_NUMERIC_INPUT:'A required input is not a number. Review the field values.',
 DIVISION_BY_ZERO:'This calculation divides by zero. Review its inputs.',
 INVALID_FORMULA:'The formula could not be read. Ask a project Admin to review its definition.',
 NON_FINITE_RESULT:'The result is outside the supported numeric range.',
 DEPENDENCY_LIMIT:'This calculation has too many nested dependencies.',
 MISSING_RELATIONSHIP:'Choose related tasks to calculate this rollup.',
}
export const fieldError=(code:string)=>explanations[code]??'This calculation is unavailable. Ask a project Admin to review it.'
