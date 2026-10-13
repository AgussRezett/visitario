# Builds ruteo_viernes.xlsx: a spreadsheet shaped like Panda's daily routing (78 rows).
# Usage: python3 e2e/fixtures/make-sheet.py
from pathlib import Path
from openpyxl import Workbook

streets = ['Tres Arroyos', 'Amenábar', 'Moldes', 'Juramento', 'Olazábal', 'Cabildo', 'Ciudad de la Paz', 'Vidal', 'Cuba', 'Echeverría', 'Mendoza', 'Monroe', 'Blanco Encalada']
people = ['Agus', 'Lucía', 'Valentina', 'Diego', 'Nico F.']
wb = Workbook()
ws = wb.active
ws.title = 'Viernes'
ws.append(['CLIENTE', 'RAZÓN SOCIAL', 'DOMICILIO', 'LOCALIDAD', 'REPOSITOR', 'VENDEDOR'])
for i in range(78):
    ws.append([20000 + i, f'Autoservicio {i + 1}', f'{streets[i % len(streets)]} {1000 + i * 7}', 'Belgrano', people[i % len(people)], 'Ramírez'])
wb.create_sheet('Notas').append(['Ruteo armado por Martín'])
wb.save(Path(__file__).with_name('ruteo_viernes.xlsx'))
