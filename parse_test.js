// Create a copy of the function here so we can iterate on it directly before saving back to the app
function testParser(fullText) {
    const summary = { affectedPlaces: [] };
    const startRegex = /LOCATIONS\s+IMPACTED\s+INCLUDE(?:\.\.\.|\:)/i;
    const matchStart = fullText.match(startRegex);
    
    if (matchStart) {
        let afterText = fullText.substring(matchStart.index + matchStart[0].length);
        
        // Expanded the regex to catch all capitals action phrases that aren't places
        const endRegex = /\n\n|\n\s*\*|\n\s*[A-Z]{3,}\.\.\.|PRECAUTIONARY\/PREPAREDNESS ACTIONS|&&|\$\$|TIME\.\.\.MOT\.\.\.LOC|THIS INCLUDES|TAKE COVER NOW\!/i;
        const matchEnd = afterText.match(endRegex);
        
        let locationsBlock = matchEnd ? afterText.substring(0, matchEnd.index) : afterText;
        
        locationsBlock = locationsBlock
            .replace(/\n *\*/g, ',')           
            .replace(/\n/g, ' ')               
            .replace(/\s+/g, ' ')              
            .replace(/\b(?:This includes|Including)\b/gi, ',') 
            .trim();
            
        // First split by sentence enders like period, exclamation, so we don't bleed into paragraphs.
        let firstSentence = locationsBlock.split(/[\.\!]/)[0] + '.';

        // Strip the trailing period
        firstSentence = firstSentence.replace(/\.$/, '').trim();

        // Split by commas or and
        let places = firstSentence.split(/,|;| and /i)
            .map(p => p.trim())
            .filter(p => {
                return p.length > 2 && 
                       !/^[\d\W]+$/.test(p) && 
                       p.toLowerCase() !== 'locations impacted include';
            });
            
        places = places.map(p => p.replace(/[\.\:]+$/, '').trim());
        summary.affectedPlaces = [...new Set(places)];
        summary.rawBlock = locationsBlock;
    }
    return summary;
}

const testCases = [
    `* LOCATIONS IMPACTED INCLUDE...
  Jackson Center, Russells Point, Lakeview, Waynesfield,
  Chippewa Park, New Hampshire, Bloom Center and Lewistown.

TAKE COVER NOW! Move to a basement or an interior room on the lowest floor of a sturdy building. Avoid windows. If you are outdoors, in a mobile home, or in a vehicle, move to the closest substantial shelter and protect yourself from flying debris.`
];

console.log("--- TESTING NEW PARSER ALGORITHM ---");
testCases.forEach((t, i) => {
    console.log(`\nTest Case ${i+1}:`);
    const result = testParser(t);
    console.log("Extracted Places:", result.affectedPlaces);
    console.log("Raw Block:", result.rawBlock);
});
