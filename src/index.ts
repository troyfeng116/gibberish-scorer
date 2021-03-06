import { BigramMatrix } from './bigram'
import { TrigramMatrix } from './trigram'

/**
 * Contains `strict`, `loose`, and `avg` numerical field definitions used to indicate strictness when testing for gibberish.
 *
 * If a query's numerical score is less than `strict`, for example, that query would be marked as gibberish regardless of indicated strictness.
 * But if a query's score falls between `avg` and `loose`, that query would be marked as gibberish if and only if `CutoffScoreStrictness.Loose` is indicated.
 */
export interface CutoffScore {
    strict: number
    avg: number
    loose: number
}

/**
 * Members of the `CutoffScoreStrictness` enum can optionally be passed to `TextScorer` when calling `isGibberish` or `getDetailedWordInfo` to indicate desired strictness.
 * Enum members include:
 * - #### `CutoffScoreStrictness.Strict`
 *      More strict treatment of misspelling, partial gibberish, etc.
 *      (i.e. more likely to label any query as gibberish).
 *      May generate more false positives for gibberish.
 * - #### `CutoffScoreStrictness.Loose`
 *      Less strict treatment of misspelling, partial gibberish, etc.
 *      (i.e. less likely to label any query as gibberish).
 *      May fail to correctly label some minor misspelling or partial gibberish as gibberish.
 * - #### `CutoffScoreStrictness.Avg`
 *      Strictness in between `Strict` and `Loose`.
 */
export enum CutoffScoreStrictness {
    Strict = 'Strict',
    Avg = 'Avg',
    Loose = 'Loose',
}

/**
 * Defines public methods for `NGramMatrix` objects.
 * Implemented by `BigramMatrix` and `TrigramMatrix`.
 */
export interface NGramMatrix {
    /**
     * Additional training on matrix in addition to prior training.
     * Automatically relearns cutoff score predictions.
     * @param text Training corpus.
     */
    train: (text: string) => void
    /**
     * Returns score for query string.
     * @param text Query string to be scored.
     * @returns Score for query corresponding to average n-gram occurrence probability.
     */
    getScore: (text: string) => number
    /**
     * Retrieves cutoff scores at all levels of strictness.
     * @returns `CutoffScore` object containing predicted `strict`, `loose`, and `avg` strictness values.
     */
    getCutoffScores: () => CutoffScore
    /**
     * Overrides previously learned cutoff score predictions by processing scores of few-shot text samples.
     */
    recalibrateCutoffScores: (goodSamples?: string[], badSamples?: string[]) => void
    /**
     * Returns whether query string is gibberish according to indicated strictness.
     * @param text The query string to be tested.
     * @param strictness Indicates the desired level of strictness.
     * @returns `true` if query is gibberish, `false` otherwise.
     */
    isGibberish: (text: string, strictness?: CutoffScoreStrictness) => boolean
    /**
     * Returns detailed analysis of query string broken down word-by-word.
     * @param text A query string to be analyzed word-by-word for scoring.
     * @param strictness Indicates the desired strictness of the cutoff score. Defaults to `CutoffScoreStrictness.Avg`.
     * @returns Object containing:
     *      - `numWords`: the number of word tokens in query.
     *      - `numGibberishWords`: the number of gibberish word tokens.
     *      - `words`: an array containing the individual word tokens extracted from query.
     *      - `gibberishWords`: subset of `words` determined to be gibberish.
     *      - `cutoffs`: the `CutoffScore` object used to determine gibberish tokens.
     */
    getWordByWordAnalysis: (
        text: string,
        strictness?: CutoffScoreStrictness,
    ) => {
        numWords: number
        numGibberishWords: number
        words: { word: string; score: number }[]
        gibberishWords: { word: string; score: number }[]
        cutoffs: CutoffScore
    }
}

/**
 * Additional initialization options for `NGramMatrix` constructors. All `NGramMatrixOptions` fields are optional:
 * - #### `initialTrainingText`
 *      Baseline corpus from which `TextScorer` learns n-gram frequencies.
 *      Recommended to use a well-formed and substantial corpus.
 *      Defaults to J.K. Rowlings's *Harry Potter and the Sorcerer's Stone*.
 * - #### `goodSamples`
 *      An array of strings consisting of well-formed queries (phrases, sentences, words, etc.).
 *      Used to calculate cutoff score predictions by learning typical scores of well-formed samples.
 *      Defaults to hard-coded array of well-formed English strings.
 * - #### `badSamples`
 *      An array of strings consisting of misspelled or gibberish queries.
 *      Used to calculate cutoff score predictions by learning typical scores of gibberish samples.
 *      Defaults to hard-coded array of badly misspelled and gibberish English strings.
 * - #### `ignoreCase`
 *      Indicates whether model should convert all training and query inputs to lower case.
 *      Defaults to `true` (prefers `ignoreCase` for less nodes and more efficient training).
 * - #### `additionalCharsToInclude`
 *      A string consisting of additional chars to include as n-gram nodes, in addition to default chars (`a-z` and white space, plus `A-Z` if `ignoreCase` is `false`).
 *      For example, initializing with `additionCharsToInclude = '.,;?!` would add nodes for common punctuation chars.
 *      Note that adding many additional chars may affect runtime, increase noise, and flatten overall distribution, causing more unpredictability for binary gibberish prediction operations.
 *      Defaults to empty string (i.e. model only considers alphabetic chars and spaces).
 */
export interface NGramMatrixOptions {
    initialTrainingText?: string
    goodSamples?: string[]
    badSamples?: string[]
    ignoreCase?: boolean
    additionalCharsToInclude?: string
}

interface TextScorerInterface {
    readonly NGramMatrix: NGramMatrix
    trainWithEnglishText: (text: string) => void
    recalibrateCutoffScores: (goodSamples: string[], badSamples: string[]) => void
    isGibberish: (text: string, strictness?: CutoffScoreStrictness) => boolean
    getTextScore: (text: string) => number
    getCutoffScores: () => CutoffScore
    getTextScoreAndCutoffs: (text: string) => { cutoffs: CutoffScore; score: number }
    getDetailedWordInfo: (
        text: string,
        strictness?: CutoffScoreStrictness,
    ) => {
        numWords: number
        numGibberishWords: number
        words: { word: string; score: number }[]
        gibberishWords: { word: string; score: number }[]
        cutoffs: CutoffScore
    }
}

export class TextScorer implements TextScorerInterface {
    /**
     * Underlying `NGramMatrix` object used to track n-gram frequency models.
     * @readonly
     */
    readonly NGramMatrix: NGramMatrix

    /**
     * Initializes `TextScorer` object.
     * @param useBigram Indicates whether to use bigrams or trigrams for training and for scoring inputs. Defaults to `true` (prefers bigrams).
     * @param options Additional initialization options for `NGramMatrix` constructors. All `NGramMatrixOptions` fields are optional:
     * - #### `initialTrainingText`
     *      Baseline corpus from which `TextScorer` learns n-gram frequencies.
     *      Recommended to use a well-formed and substantial corpus.
     *      Defaults to J.K. Rowlings's *Harry Potter and the Sorcerer's Stone*.
     * - #### `goodSamples`
     *      An array of strings consisting of well-formed queries (phrases, sentences, words, etc.).
     *      Used to calculate cutoff score predictions by learning typical scores of well-formed samples.
     *      Defaults to hard-coded array of well-formed English strings.
     * - #### `badSamples`
     *      An array of strings consisting of misspelled or gibberish queries.
     *      Used to calculate cutoff score predictions by learning typical scores of gibberish samples.
     *      Defaults to hard-coded array of badly misspelled and gibberish English strings.
     * - #### `ignoreCase`
     *      Indicates whether model should convert all training and query inputs to lower case.
     *      Defaults to `true` (prefers `ignoreCase` for less nodes and more efficient training).
     * - #### `additionalCharsToInclude`
     *      A string consisting of additional chars to include as n-gram nodes, in addition to default chars (`a-z` and white space, plus `A-Z` if `ignoreCase` is `false`).
     *      For example, initializing with `additionCharsToInclude = '.,;?!` would add nodes for common punctuation chars.
     *      Note that adding many additional chars may affect runtime, increase noise, and fla
     */
    constructor(useBigram = true, options?: NGramMatrixOptions) {
        this.NGramMatrix = useBigram ? new BigramMatrix(options) : new TrigramMatrix(options)
    }

    /**
     * Additional training for `TextScorer` with desired corpus to reinforce or adjust previously learned n-gram frequency distributions.
     * Note that this method also automatically recalibrates all cutoff scores based on the new learned probabilities.
     * @param text A well-formed training corpus for additional n-gram probability learning, *in addition to* baseline and prior training.
     */
    trainWithEnglishText = (text: string): void => this.NGramMatrix.train(text)

    /**
     * Recalibrates `TextScorer` object's cutoff score predictions.
     * Note that this method will override the previous cutoff scores.
     * @param goodSamples An array of strings consisting of well-formed queries (phrases, sentences, words, etc.).
     * @param badSamples An array of strings consisting of misspelled or gibberish queries.
     */
    recalibrateCutoffScores = (goodSamples: string[], badSamples: string[]): void => this.NGramMatrix.recalibrateCutoffScores(goodSamples, badSamples)

    /**
     * Given query string, determines whether query is gibberish or not.
     * @param text A query string to be tested for whether it is gibberish.
     * @param strictness Indicates the desired strictness of the cutoff score.
     *      Must be a member of the `CutoffScoreStrictness` enum.
     *      Defaults to `CutoffScoreStrictness.Avg`.
     * @returns `true` if gibberish, `false` otherwise.
     */
    isGibberish = (text: string, strictness = CutoffScoreStrictness.Avg): boolean => this.NGramMatrix.isGibberish(text, strictness)

    /**
     * Given query string, returns numerical score between `0` and `1` corresponding to average probability of n-gram occurrences in query.
     * @param text A query string for which to retrieve a score.
     * @returns A number corresponding to the average probability of n-gram occurrences in `text`.
     */
    getTextScore = (text: string): number => this.NGramMatrix.getScore(text)

    /**
     * Retrieves `strict`, `loose`, and `avg` cutoff scores.
     * @returns `CutoffScore` object containing `strict`, `loose`, and `avg` cutoff score predictions.
     */
    getCutoffScores = (): CutoffScore => this.NGramMatrix.getCutoffScores()

    /**
     * Given query string, returns numerical score and cutoffs.
     * @param text A query string for which to retrieve a score.
     * @returns Object containing a `CutoffScore` object `cutoffs` and a numerical `score` between `0` and `1` corresponding to query.
     */
    getTextScoreAndCutoffs = (text: string): { cutoffs: CutoffScore; score: number } => {
        const cutoffScores = this.NGramMatrix.getCutoffScores()
        const matrixScore = this.NGramMatrix.getScore(text)
        return { cutoffs: cutoffScores, score: matrixScore }
    }

    /**
     * Given query string, returns detailed analysis of query broken down word-by-word.
     * @param text A query string to be analyzed word-by-word for scoring.
     * @param strictness Indicates the desired strictness of the cutoff score.
     *      Must be a member of the `CutoffScoreStrictness` enum.
     *      Defaults to `CutoffScoreStrictness.Avg`.
     * @returns Object containing:
     *      - `numWords`: the number of word tokens in query.
     *      - `numGibberishWords`: the number of gibberish word tokens.
     *      - `words`: an array containing the individual word tokens extracted from query.
     *      - `gibberishWords`: subset of `words` determined to be gibberish.
     *      - `cutoffs`: the `CutoffScore` object used to evaluate the query for gibberish tokens.
     */
    getDetailedWordInfo = (
        text: string,
        strictness?: CutoffScoreStrictness,
    ): {
        numWords: number
        numGibberishWords: number
        words: { word: string; score: number }[]
        gibberishWords: { word: string; score: number }[]
        cutoffs: CutoffScore
    } => {
        return this.NGramMatrix.getWordByWordAnalysis(text, strictness)
    }
}
