/**
 * A deterministic parser that extracts key information from standard NWS warning text.
 * Mimics an LLM summary but runs instantly in the browser for free.
 */

export function parseNwsAlert(description, instruction) {
    const fullText = `${description || ''}\n${instruction || ''}`;

    const summary = {
        hazards: "Severe weather conditions. Refer to full text.",
        position: "Position detailed in full text.",
        situation: "Active weather event.",
        affectedPlaces: []
    };

    // 1. Extract Hazards
    // NWS often formats hazards as "HAZARD...Tornado and quarter size hail." or "* HAZARD...Tornado."
    const hazardMatch = fullText.match(/HAZARD[\. ]+([^\n]+)/i);
    if (hazardMatch && hazardMatch[1]) {
        // Clean up trailing asterisks or periods
        summary.hazards = hazardMatch[1].replace(/[\*\.]+$/, '').trim();
    } else if (fullText.toLowerCase().includes("tornado warning")) {
        summary.hazards = "Tornado";
    }

    // 2. Extract Position / Movement
    // "At 405 PM CDT, a severe thunderstorm capable of producing a tornado was located near..."
    const positionMatch = fullText.match(/(?:At|At \d{1,2}\d{2} [AP]M [A-Z]{3}),?\s*(.*?was located.*?moving.*?(?:mph|\.|and))/i);
    if (positionMatch && positionMatch[1]) {
        summary.position = positionMatch[1].trim();
    }

    // 3. Extract Situation / Source
    // NWS format: "SOURCE...Radar indicated rotation." or "SOURCE...Weather spotters confirmed tornado."
    const sourceMatch = fullText.match(/SOURCE[\. ]+([^\n]+)/i);
    if (sourceMatch && sourceMatch[1]) {
        summary.situation = sourceMatch[1].replace(/[\*\.]+$/, '').trim();
    } else if (fullText.includes("capable of producing a tornado")) {
        summary.situation = "Storm capable of producing a tornado.";
    }

    // 4. Extract Affected Places
    // Need to handle various formats of NWS warnings, especially how they terminate the locations block
    
    // Most common: "* LOCATIONS IMPACTED INCLUDE...\n  Dallas, Fort Worth, Arlington..."
    // Sometimes ends with: "PRECAUTIONARY/PREPAREDNESS ACTIONS...", "&&", "$$", or just a new section like "TIME...MOT...LOC"
    
    // Step 1: Find where the locations section starts
    const startRegex = /LOCATIONS\s+IMPACTED\s+INCLUDE(?:\.\.\.|\:)/i;
    const matchStart = fullText.match(startRegex);
    
    if (matchStart) {
        // Get everything after the start phrase
        let afterText = fullText.substring(matchStart.index + matchStart[0].length);
        
        // Expanded the regex to catch all capitals action phrases that aren't places
        const endRegex = /\n\n|\n\s*\*|\n\s*[A-Z]{3,}\.\.\.|PRECAUTIONARY\/PREPAREDNESS ACTIONS|&&|\$\$|TIME\.\.\.MOT\.\.\.LOC|THIS INCLUDES|TAKE COVER NOW\!/i;
        const matchEnd = afterText.match(endRegex);
        
        let locationsBlock = matchEnd ? afterText.substring(0, matchEnd.index) : afterText;
        
        // Step 3: Clean up the text
        locationsBlock = locationsBlock
            .replace(/\n *\*/g, ',')           // Replace bullets with commas
            .replace(/\n/g, ' ')               // Collapse newlines
            .replace(/\s+/g, ' ')              // Collapse multiple spaces
            .replace(/\b(?:This includes|Including|And)\b/gi, ',') // Remove joining words
            .trim();
        
        // First split by sentence enders like period, exclamation, so we don't bleed into paragraphs.
        let firstSentence = locationsBlock.split(/[\.\!\?]/)[0] + '.';

        // Strip the trailing period
        firstSentence = firstSentence.replace(/\.$/, '').trim();
        
        // Step 4: Split into individual places
        let places = firstSentence.split(/,|;| and /i)
            .map(p => p.trim())
            .filter(p => {
                // Keep only valid-looking names
                return p.length > 2 && 
                       !/^[\d\W]+$/.test(p) && 
                       p.toLowerCase() !== 'locations impacted include';
            });
            
        // Clean up trailing punctuation on individual places
        places = places.map(p => p.replace(/[\.\:]+$/, '').trim());

        // Deduplicate
        summary.affectedPlaces = [...new Set(places)];
    }

    return summary;
}

/**
 * Parses the lengthy SPC Severe Weather Outlook (ACUS01, 02, 03) into a quick summary.
 * Extracts the official SUMMARY section and highlights specific categorical threats.
 */
export function parseOutlookSummary(text) {
    if (!text) return null;

    const result = {
        overallSummary: "Please read the full detailed meteorological discussion below.",
        threats: {
            tornado: null,
            wind: null,
            hail: null
        }
    };

    // 1. Extract the official "...SUMMARY..." block if present
    // The block usually starts with "...SUMMARY..." and ends with the next section header (e.g. "...LOCATION...", "...DISCUSSION...")
    const summaryMatch = text.match(/\.\.\.\s*SUMMARY\s*\.\.\.\s*\n([\s\S]*?)(?=\n\.\.\.|$)/i);
    if (summaryMatch && summaryMatch[1]) {
        result.overallSummary = summaryMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // 2. Extract specific threat sentences/context from the text
    // We look for the first sentence containing the threat keyword to give quick context
    const getThreatContext = (keyword) => {
        // Split by period to get sentences
        const sentences = text.split(/\.\s+/);
        for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(keyword)) {
                return sentence.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() + ".";
            }
        }
        return null;
    };

    const upperText = text.toUpperCase();

    // Highlight Tornado risk
    if (upperText.includes("TORNADO") || upperText.includes("TORNADOES")) {
        result.threats.tornado = getThreatContext("tornado");
    }

    // Highlight Wind risk
    if (upperText.includes("WIND") || upperText.includes("GUST")) {
        result.threats.wind = getThreatContext("wind") || getThreatContext("gust");
    }

    // Highlight Hail risk
    if (upperText.includes("HAIL") || upperText.includes("HAILSTONES")) {
        result.threats.hail = getThreatContext("hail");
    }

    return result;
}
