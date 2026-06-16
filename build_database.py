import csv
import urllib.request
import json

AIRPORTS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
RUNWAYS_CSV_URL = 'https://davidmegginson.github.io/ourairports-data/runways.csv'
OUTPUT_JSON = 'airfields.json'

def fetch_runways():
    print("1. Téléchargement des pistes (runways.csv)...")
    runways_dict = {}
    
    response = urllib.request.urlopen(RUNWAYS_CSV_URL)
    lines = [l.decode('utf-8') for l in response.readlines()]
    reader = csv.DictReader(lines)
    
    for row in reader:
        icao = row.get('airport_ident', '').strip()
        length_ft_str = row.get('length_ft', '')
        
        if length_ft_str:
            length_m = int(float(length_ft_str) * 0.3048)
            surface = row.get('surface', 'UNK').upper()
            qfu_1 = row.get('le_ident', '')
            qfu_2 = row.get('he_ident', '')
            rwy_ident = f"{qfu_1}/{qfu_2}" if qfu_1 and qfu_2 else qfu_1
            
            if icao not in runways_dict or length_m > runways_dict[icao]['rwy_len']:
                runways_dict[icao] = {
                    'rwy_len': length_m,
                    'surface': surface[:4], # Garde les 4 premières lettres max
                    'rwy_ident': rwy_ident
                }
    return runways_dict

def build_database():
    runways_data = fetch_runways()
    print("2. Téléchargement des aérodromes (airports.csv)...")
    
    response = urllib.request.urlopen(AIRPORTS_CSV_URL)
    lines = [l.decode('utf-8') for l in response.readlines()]
    reader = csv.DictReader(lines)
    
    airfields_db = []
    valid_types = ['small_airport', 'medium_airport', 'large_airport']
    
    for row in reader:
        if row.get('iso_country') != 'FR':
            continue
            
        if row.get('type') not in valid_types:
            continue
            
        icao = row.get('ident', '').strip()
        name = row.get('name', '').strip()
        lat = row.get('latitude_deg', '')
        lon = row.get('longitude_deg', '')
        alt_ft = row.get('elevation_ft', '0')
        
        if not lat or not lon or not icao:
            continue
            
        rwy_info = runways_data.get(icao, {'rwy_len': 0, 'surface': 'N/A', 'rwy_ident': 'N/A'})
        
        airfields_db.append({
            "icao": icao,
            "name": name,
            "lat": float(lat),
            "lon": float(lon),
            "alt": int(float(alt_ft)) if alt_ft else 0,
            "rwy": rwy_info['rwy_len'],
            "sfc": rwy_info['surface'],
            "qfu": rwy_info['rwy_ident']
        })

    print(f"3. Sauvegarde des données...")
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(airfields_db, f, separators=(',', ':'), ensure_ascii=False)
        
    print(f"SUCCÈS ! {len(airfields_db)} aérodromes français exportés.")

if __name__ == "__main__":
    build_database()
