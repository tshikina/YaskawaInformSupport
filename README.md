# inform-job-support README

This is the README for vs code extension "YASKAWA Inform Support". 

## Features

### Syntax Highlight
This extension support syntax highlight for YASKAWA Motoman Inform language as following image.


<!-- width: 1099 -->
<img src="images/RunImage.png" width="60%" alt="Syntax highlight imamge">

This extension also support syntax highlight for other inform related files like VAR.DAT, ALL.PRM, and etc.

### Go to Definition
Go to definition to LABEL and JOBNAME is supported.

<!-- width: 1833 -->
<img src="images/GoToDefinition.png" alt="Go to definition image">

### Folding Ranges
Folding range for Inform, and other files is supported.

<!-- width: 1591 -->
<img src="images/FoldingRange.png" width="87%" alt="Folding range image">

### Hover
Hover parameter number in .PRM files.

<!-- widht: 432 -->
<img src="images/HoverParameterNumber.png" width="24%" alt="Hover paramter number">

## Recommened Setting for Japanese Language User
日本語を使用する場合は、Inform用の言語設定で、「auto guess encoding」をfalseに、「encoding」にshiftjisを設定してください。
これらの設定は、以下で検索できます。
````
@id:files.autoGuessEncoding @id:files.encoding @lang:inform
@id:files.autoGuessEncoding @id:files.encoding @lang:informdat
@id:files.autoGuessEncoding @id:files.encoding @lang:pscfile
````
<!--  widht: 1447 -->
<img src="images/EncodingSetting.png" width="79%" alt="Hover paramter number">


## Known Issues


## Release Notes
### [1.0.0]
- Changed language id

See [CHANGELOG](./CHANGELOG.md) for more informaiton.

