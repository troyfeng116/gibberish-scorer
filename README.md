# text-scorer (v2.0.0)

A configurable text scorer/gibberish detector.

## Installation

```bash
npm install text-scorer
```

## Description and Use Cases
This text scoring model implements a matrix that tracks the probabilities of character bigram and trigram transitions, i.e. a Markov chain where the event chains consist of character bigrams and trigrams and the transition probabilities correspond to approximate relative frequencies of each chain within the English language. The model consists of three major parts:
1. English language training. A large corpus (for example, the default training text is a Harry Potter novel) is passed to the model to learn the relative frequencies of all character N-grams. For example, the model will learn through training that the `t-h` bigram is much more likely to occur than the `q-g` bigram.
2. Cutoff training. A sample of good and bad inputs is passed to the model so that it can calculate predictions for what the cutoff point between gibberish and non-gibberish will be.
3. Input/output. Inputs passed to the trained model will be evaluated and assigned a score (the average of all character N-gram probabilities in the input). That score is compared against the model's cutoff predictions to come up with the final predictions.

Sample use cases:
* Filter gibberish spam from list of tweets, emails, survey responses, etc.
* Check if the input to a text field or a form is gibberish
* Remove nonsensical tokens from tokenized text input


## Usage and Examples

### Import module
```js
import { GibberishScorer } from 'gibberish-scorer'
import { CutoffScoreStrictness, NGramMatrix } from 'gibberish-scorer' // Additional type imports
```


### Constructor
```ts
const gibberishScorer = new GibberishScorer(useBigram?: boolean, options?: {
    initialTrainingText?: string
    goodSamples?: string[]
    badSamples?: string[]
    ignoreCase?: boolean
    additionalCharsToInclude?: string
})
```
Instantiates new `GibberishScorer` object. Constructor takes optional arguments `useBigram` (defaults to `true`, which prefers bigrams over trigrams) and `options`:

| `options` field | type | purpose/description | default value |
| :--- | :--- | :--- | :--- |
| `initialTrainingText` | `string` | An English corpus/text in string format to initialize N-gram probability matrix | stringified Harry Potter & the Sorcerer's Stone |
| `goodSamples` | `string[]` | An array of manually selected correctly-spelled English sentences to calculate predicted cutoff scores in conjunction with `badSamples` | hard-coded array of English sentence strings |
| `badSamples` | `string[]` | An array of gibberish strings to calculate predicted cutoff scores in conjunction with `goodSamples` | hard-coded array of gibberish strings |
| `ignoreCase` | `boolean` | If `true`, converts all training input text and scoring output text to lower case. Else, considers upper lower case chars in N-grams | `true` |
| `additionalCharsToInclude` | `string` | All unique chars in `additionalCharsToInclude` are appended to the base set of chars (`[a-z]` and space, or unicodes 97-122 and 32) to include in N-grams. | `''` |


### `isGibberish`
```js
gibberishScorer.isGibberish('The quick fox jumps over the lazy dog') // false
gibberishScorer.isGibberish('Tom Brady') // false
gibberishScorer.isGibberish('oqbwifsiehf osdfbw sjkdoo thehwei') // true
gibberishScorer.isGibberish('This sentence is half gibberish lwpqgtyukcvi', CutoffScoreStrictness.Loose) // false
gibberishScorer.isGibberish('This sentence is half gibberish lwpqgtyukcvi', CutoffScoreStrictness.Strict) // true
```
Returns whether input text string is gibberish, according to trained cutoff predictions and desired strictness. `strictness` argument must be of a member of the `CutoffScoreStrictness` enum (`Strict | Avg | Loose`), where `CutoffScoreStrictness.Strict` will classify more input strings as gibberish and `CutoffScoreStrictness.Loose` will classify fewer input strings as gibberish. The `strictness` argument defaults to `Avg`. 


### `trainWithEnglishText`
```js
gibberishScorer.trainWithEnglishText(my_own_training_text) // Additional training for gibberishScorer if desired
```
Trains the `GibberishScorer` with any training string passed to it. This will re-adjust the N-gram probabilities *on top of the initial training and any prior training*. Training also automatically recalibrates cutoff score predictions. Recommended to train only on long training corpus in accurate English.


### `recalibrateCutoffScores`
```js
gibberishScorer.recalibrateCutoffScores(good_sample_texts, bad_sample_texts) // Recalculate predicted score cutoffs based on provided samples
```
Manually re-calibrate the estimated cutoff scores. Takes parameters of two hand-picked `string[]` of good and bad sample texts.


### `getTextScore`
```js
gibberishScorer.getTextScore('The quick fox jumps over the lazy dog') // 0.07108346875540186
gibberishScorer.getTextScore('asdk akljhsug wertgbk') // 0.009196665505633908
```
Returns actual calculated number score of input text (average probability of all N-grams in input text: range between `0` and `1` with avg `1/26` for bigrams and `1/(26*26) = 1/676` for trigrams). Useful for viewing scores of input texts to choose your own hard-coded cutoff score points.


### `getCutoffScores`
```js
gibberishScorer.getCutoffScores()
// {
//    loose: 0.017614231370230753,
//    avg: 0.025681000339544513,
//    strict: 0.033747769308858276
//  },
```
Returns predicted cutoff scores at all three strictness levels (`loose`, `avg`, and `strict`).


### `getTextScoreAndCutoffs`
```js
gibberishScorer.getTextScoreAndCutoffs('This sentence is half gibberish lwpqgtyukcvi')
// {
//   cutoffs: {
//     loose: 0.017614231370230753,
//     avg: 0.025681000339544513,
//     strict: 0.033747769308858276
//   },
//   score: 0.029883897109006206
// }
```
Returns current predicted cutoff scores of `NGramMatrix` bundled together with the calculated numerical score of input text for further inspection.


### Type and enum definitions
```ts
interface GibberishScorerInterface {
    NGramMatrix: NGramMatrix
    trainWithEnglishText: (text: string) => void
    recalibrateScoreCutoffs: (goodSamples: string[], badSamples: string[]) => void
    isGibberish: (text: string, strictness?: CutoffScoreStrictness) => boolean
    getTextScore: (text: string) => number
    getScoreCutoffs: () => CutoffScore
    getTextScoreAndCutoffs: (text: string) => { cutoffs: CutoffScore; score: number }
}

class GibberishScorer implements GibberishScorerInterface {}

interface NGramMatrix {
    cutoffScores: CutoffScore
    train: (text: string) => void
    getScore: (text: string) => number
    recalibrateCutoffScores: (goodSamples?: string[], badSamples?: string[]) => void
    isGibberish: (text: string, strictness?: CutoffScoreStrictness) => boolean
}

interface NGramMatrixOptions {
    initialTrainingText?: string
    goodSamples?: string[]
    badSamples?: string[]
    ignoreCase?: boolean
    additionalCharsToInclude?: string
}

enum CutoffScoreStrictness {
    Strict = 'Strict',
    Avg = 'Avg',
    Loose = 'Loose',
}
```


## License

[MIT](https://choosealicense.com/licenses/mit/)
