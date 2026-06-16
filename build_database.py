import csv, urllib.request, json

def fetch_runways():
    runways_dict = {}
    response = urllib.request.urlopen('https://davidmegginson.github.io/ourairports-data/runways.csv')
    lines = [l.decode('utf-8') for l in response.readlines()]
    reader = csv.DictReader(lines)
    for row in reader:
        icao = row.get('airport_ident', '').strip()
        length_ft = row.get('length_ft', '')
        if length_ft:
            length_m = int(float(length_ft) * 0.3048)
            qfu_1, qfu_2 = row.get('le_ident', ''), row.get('he_ident', '')
            if icao not in runways_dict or length_m > runways_dict[icao]['rwy']:
                runways_dict[icao] = {
                    'rwy': length_m,
                    'sfc': row.get('surface', 'UNK').upper()[:4],
                    'qfu': f"{qfu_1}/{qfu_2}" if qfu_1 and qfu_2 else qfu_1
                }
    return runways_dict

def build_db():
    rwy_data = fetch_runways()
    response = urllib.request.urlopen('https://davidmegginson.github.io/ourairports-data/airports.csv')
    lines = [l.decode('utf-8') for l in response.readlines()]
    reader = csv.DictReader(lines)
    
    airfields = []
    valid = ['small_airport', 'medium_airport', 'large_airport']
    
    for row in reader:
        if row.get('iso_country') == 'FR' and row.get('type') in valid:
            icao = row.get('ident', '')
            if not icao: continue
            r_info = rwy_data.get(icao, {'rwy': 0, 'sfc': 'N/A', 'qfu': 'N/A'})
            airfields.append({
                "icao": icao,
                "name": row.get('name', ''),
                "lat": float(row.get('latitude_deg', 0)),
                "lon": float(row.get('longitude_deg', 0)),
                "alt": int(float(row.get('elevation_ft', 0))) if row.get('elevation_ft') else 0,
                "rwy": r_info['rwy'], "sfc": r_info['sfc'], "qfu": r_info['qfu']
            })

    with open('airfields.json', 'w', encoding='utf-8') as f:
        json.dump(airfields, f, separators=(',', ':'), ensure_ascii=False)

if __name__ == "__main__":
    build_db()
