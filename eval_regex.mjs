function parseNwsAlert(description, instruction) {
    const fullText = `${description || ''}\n${instruction || ''}`;

    const summary = {
        hazards: "Severe weather conditions. Refer to full text.",
        position: "Position detailed in full text.",
        situation: "Active weather event.",
        affectedPlaces: []
    };

    const hazardMatch = fullText.match(/HAZARD[\. ]+([^\n]+)/i);
    if (hazardMatch && hazardMatch[1]) {
        summary.hazards = hazardMatch[1].replace(/[\*\.]+$/, '').trim();
    } else if (fullText.toLowerCase().includes("tornado warning")) {
        summary.hazards = "Tornado";
    }

    const positionMatch = fullText.match(/(?:At|At \d{1,2}\d{2} [AP]M [A-Z]{3}),?\s*(.*?was located.*?moving.*?(?:mph|\.|and))/i);
    if (positionMatch && positionMatch[1]) {
        summary.position = positionMatch[1].trim();
    }

    const sourceMatch = fullText.match(/SOURCE[\. ]+([^\n]+)/i);
    if (sourceMatch && sourceMatch[1]) {
        summary.situation = sourceMatch[1].replace(/[\*\.]+$/, '').trim();
    } else if (fullText.includes("capable of producing a tornado")) {
        summary.situation = "Storm capable of producing a tornado.";
    }

    let locationsMatch = fullText.match(/LOCATIONS IMPACTED INCLUDE\.\.\.([\s\S]*?)(?:\n\n|PRECAUTIONARY\/PREPAREDNESS ACTIONS|\* |&&|THIS INCLUDES)/i);
    
    if (!locationsMatch && fullText.toUpperCase().includes("LOCATIONS IMPACTED INCLUDE...")) {
        const parts = fullText.split(/LOCATIONS IMPACTED INCLUDE\.\.\./i);
        if (parts.length > 1) {
             let after = parts[1];
             let cleaned = after.split(/\n\n|PRECAUTIONARY|&&/i)[0];
             locationsMatch = [null, cleaned];
        }
    }

    if (locationsMatch && locationsMatch[1]) {
        let locText = locationsMatch[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        locText = locText.replace(/\.$/, '');
        const places = locText.split(/,| and /i).map(p => p.trim()).filter(p => p && p.length > 2 && p.toLowerCase() !== 'including');
        summary.affectedPlaces = places;
    }

    return summary;
}

const kinneyText = `...TORNADO WARNING REMAINS IN EFFECT UNTIL 530 PM CDT FOR SOUTHEASTERN KINNEY COUNTY...

At 502 PM CDT, a severe thunderstorm capable of producing a tornado was located over Spofford, or 10 miles south of Brackettville, moving northeast at 35 mph.

HAZARD...Tornado and quarter size hail.

SOURCE...Radar indicated rotation.

IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur.  Tree damage is likely.

Locations impacted include...
Spofford.

PRECAUTIONARY/PREPAREDNESS ACTIONS...`;

const callahanText = `...A TORNADO WARNING REMAINS IN EFFECT UNTIL 545 PM CDT FOR NORTHEASTERN CALLAHAN COUNTY...

At 511 PM CDT, a severe thunderstorm capable of producing a tornado was located near Baird, moving east at 20 mph.

HAZARD...Tornado.

SOURCE...Radar indicated rotation.

IMPACT...Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed. Damage to roofs, windows, and vehicles will occur.  Tree damage is likely.

* LOCATIONS IMPACTED INCLUDE...
  Baird, Rowden, and Putnam.

PRECAUTIONARY/PREPAREDNESS ACTIONS...`;

console.log("Kinney Assessment => ", JSON.stringify(parseNwsAlert(kinneyText, ''), null, 2));
console.log("Callahan Assessment => ", JSON.stringify(parseNwsAlert(callahanText, ''), null, 2));
