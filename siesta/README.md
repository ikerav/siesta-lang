# Siesta 💤

**Código con derecho al descanso.** Un lenguaje pequeño en español con una batería de energía: trabajar gasta pilas, `siesta;` las recupera. Archivos `.zzz`, funciones `receta` y una consola bastante chivata.

Incluye un intérprete real (tokenizer → parser → AST → evaluador), playground web, inspector de tokens y árbol, variables, traza de ejecución, seis ejemplos y CLI. Sin dependencias de ejecución ni de desarrollo. Todo el código del usuario se ejecuta en su navegador, dentro de un Web Worker.

## Arranca en 30 segundos

Requisitos: Node.js 18+ para CLI/tests y Python 3 para el servidor de desarrollo.

```sh
npm test
npm run dev
# Abre http://localhost:4173
```

No necesitas `npm install`. También puedes servir la carpeta `dist/` con cualquier servidor estático. No abras `index.html` mediante `file://`: los módulos y el Worker necesitan HTTP.

Para terminal:

```sh
node cli.js examples/hola.zzz
```

## Hola, mundo descansado

```text
pilas 12;
pon nombre = "mundo";
chiva "Hola, " + nombre;

repite 3 {
  chiva "Vuelta " + turno;
  siesta;
}
```

Pulsa **Ejecutar** o **Ctrl/Cmd + Enter**. El editor guarda el último programa en el navegador y permite descargarlo como `.zzz`. Elegir otro ejemplo o restablecerlo sustituye el contenido del editor: descarga primero el programa si quieres conservarlo.

## Lo básico

| Sintaxis | Significado |
|---|---|
| `# comentario` | Comentario hasta el final de la línea |
| `pon cafes = 2;` | Declara una variable |
| `cafes = cafes + 1;` | Modifica una variable existente |
| `chiva cafes;` | Escribe en la consola |
| `si cafes > 1 { ... } sino { ... }` | Condicional; `sino` es opcional |
| `repite 3 { chiva turno; }` | Repite; `turno` va de 1 a 3 |
| `mientras condición { ... }` | Bucle condicional |
| `receta doble(n) { sirve n * 2; }` | Función y retorno |
| `chiva doble(21);` | Llamada a una función |
| `pilas 12;` | Configura la batería, solo al inicio |
| `siesta;` | Recarga gratis e instantáneamente |

Las instrucciones simples terminan en `;`. Los bloques llevan `{ }`. No hace falta `;` después de un bloque. Los nombres distinguen mayúsculas y admiten letras Unicode, números (después de la primera letra) y `_`. Las palabras clave, incluidas `y`, `o` y `no`, están reservadas.

### Valores y operadores

- Números finitos de doble precisión, textos con comillas simples o dobles, listas, `verdad`, `mentira`, `nada` y recetas.
- Escapes de texto: `\n`, `\t`, `\r`, `\\`, `\"` y `\'`.
- Aritmética: `+ - * / %`. El `+` concatena si alguno de los operandos es texto. Dividir o calcular módulo entre cero es un error.
- Comparación: `== != < > <= >=`. Igualdad sin conversión implícita; las listas y recetas se comparan por identidad.
- Lógica: `y`, `o`, `no` (también `!`). `y` y `o` cortocircuitan. Las condiciones exigen booleanos.
- Precedencia, de menor a mayor: `o`, `y`, igualdad, comparación, suma/resta, multiplicación/división/módulo, unarios, llamadas/índices. Usa paréntesis para agrupar.
- Listas: `pon compra = ["pan", "café"]; chiva compra[0];`. Índices desde 0; fuera de rango es un error. Se pueden leer pero no modificar elementos por índice. Puedes reasignar la variable a otra lista.
- Cada bloque tiene su ámbito. Puedes modificar variables exteriores; declarar con `pon` en un bloque crea una variable local. No se puede redeclarar un nombre en el mismo ámbito.
- Las recetas tienen cierres léxicos, admiten recursión y se pueden devolver o guardar en variables. Deben estar declaradas antes de llamarlas. Sin `sirve` devuelven `nada`.

### Funciones incorporadas

| Función | Ejemplo |
|---|---|
| `largo(texto_o_lista)` | `largo([3, 4])` → `2` |
| `texto(valor)` | `texto(42)` → `"42"` |
| `numero(texto_o_numero)` | `numero("2.5")` → `2.5` |
| `redondea(numero)` | `redondea(2.6)` → `3` |
| `energia()` | Energía restante después de pagar la llamada |

Los textos usan índices y longitudes UTF-16, como JavaScript. `redondea` usa `Math.round` (los empates se redondean hacia +∞). No hay acceso a JavaScript, DOM, red ni sistema de archivos desde el lenguaje.

## La idea: programar con energía finita

La batería empieza con **40 unidades**. `pilas N;` permite elegir entre 1 y 1.000 y solo puede aparecer como primera instrucción (los comentarios no cuentan).

Se gasta una unidad:

1. Antes de cada instrucción, incluida la propia instrucción de bucle, el condicional y la definición de receta.
2. Antes de cada vuelta de un bucle.
3. En cada llamada a una receta o función incorporada.

Las instrucciones de un cuerpo también gastan. Las expresiones aritméticas, por sí mismas, no gastan energía, aunque sí pasos internos. `pilas` y `siesta` son excepciones: no gastan. La batería se comparte entre todo el programa y sus recetas.

`siesta;` restaura toda la batería sin retrasar la ejecución. También funciona cuando quedan cero unidades. Si otra instrucción intenta gastar con la batería agotada, el programa se detiene con un error y conserva lo que ya escribió.

```text
pilas 4;
repite 5 {
  chiva turno;
  siesta;
}
```

Prueba a quitar `siesta;`: el error es parte del experimento. No se trata de medir consumo energético real: es un modelo de recursos para aprender sobre ejecución, límites y puntos de descanso.

## Por dentro

```text
Código .zzz
   ↓ tokenize(source)
Tokens con tipo, lexema, valor, offset, línea y columna
   ↓ parse(tokens)
AST con precedencia y ubicaciones
   ↓ evaluate(ast)
Salida + variables + eventos + batería + errores
```

- `dist/language.js`: tokenizer manual, parser descendente recursivo y evaluador por recorrido del árbol. Ámbitos mediante `Map` y entornos encadenados. Sin `eval` ni `new Function`.
- `dist/worker.js`: ejecuta el intérprete fuera del hilo de la interfaz.
- `dist/app.js`: editor, resaltado, persistencia local, inspector, consola y descarga.
- `dist/examples.js`: los seis programas del playground.
- `dist/index.html`, `dist/style.css`: interfaz adaptable, navegación de pestañas por teclado y guía incorporada.
- `cli.js`: ejecutor Node, salida estándar y código de error 1 al fallar.
- `tests/language.test.js`: 21 pruebas de semántica, posiciones, ejemplos y límites.

API de módulos ES:

```js
import { tokenize, parse, evaluate, run } from './dist/language.js';
const result = run('chiva 6 * 7;');
console.log(result.output); // ['42']
console.log(result.error);  // null
```

`tokenize` y `parse` lanzan `SiestaError`; `evaluate` y `run` devuelven los errores del programa en `result.error`. Los errores incluyen fase, mensaje, línea y columna.

## Límites deliberados

50.000 caracteres de código; 30.000 pasos internos (instrucciones y nodos evaluados); 60 llamadas anidadas; contador de profundidad sintáctica; 500 salidas o 100.000 caracteres de consola; 100.000 caracteres por texto y límites de formato de listas. La traza conserva los primeros 400 eventos y el inspector muestra hasta 1.500 tokens. El playground termina el Worker si supera 3 segundos. Incluso un bucle infinito lleno de siestas se detiene.

El lenguaje es didáctico: no tiene módulos, clases, excepciones capturables, acceso a archivos ni asignación a elementos de listas.

## Publicación

`dist/` es un sitio estático listo para alojar. `.openai/hosting.json` contiene la configuración de esta instancia de Sites; no contiene secretos. Si bifurcas el proyecto para un Site nuevo, no reutilices su `project_id`.

## Licencia

MIT. Puedes modificarlo, ampliarlo o inventarte una sintaxis todavía más perezosa.
